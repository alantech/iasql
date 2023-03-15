# 007 - Peer review infrastructure changes RFC

### Proposed

2023-03-13

### Accepted

YYYY-MM-DD

#### Approvers

- David Ellis <david@iasql.com>
- Yolanda Robla <yolanda@iasql.com>
- Alejandro Guillen <alejandro@iasql.com>
- Mohammad Pabandi <mohammad@iasql.com>

### Implementation

- [ ] Implemented: [One or more PRs](https://github.com/iasql/iasql-engine/some-pr-link-here) YYYY-MM-DD
- [ ] Revoked/Superceded by: [RFC ###](./000 - RFC Template.md) YYYY-MM-DD

## Author(s)

- Luis Fernando De Pombo <l@iasql.com>

## Summary

Eng teams move over from using cloud UIs to IaC because cloud infrastructure changes can lead to outages more often than business logic changes. As a result, it is considered a DevOps best practice to code review infrastructure changes using IaC tools and show the `preview` of the resulting change in pull requests to raise the quality bar and reduce the possibility of mistakes. Cloud infrastructure cannot be code reviewed with IaSQL using migration systems even if they support non-schema, or data, migrations (some ORMs like Prisma only support schema changes), and each migration is wrapped in an IaSQL transaction. Through our research and dogfood efforts, we have not found a migration system that fulfills the requirements needed to code review changes with IaSQL:
- Allow data-only, `up` migrations
- Allow plain SQL or have an introspective ORM
- Free and ideally open source
- Baseline/ignore certain migrations
- Be resilient to IaSQL schema upgrades which involve tables getting dropped and recreated

Data migrations require being able to baseline migrations to avoid duplicate record violations on IaSQL schema upgrades. Flyway comes closest to meeting all our requirements. However, it is not possible to baseline/ignore existing migrations on their free product.

We could configure IaSQL schema upgrades to preserve a `migrations` table and make the name of the table configurable, but the baselining issue would remain as IaSQL schema upgrades can change the schema which renders existing migrations on past IaSQL versions invalid. As a result, we need an opinionated solution to unblock peer review of infra changes.

## Proposal

Take inspiration from [RFC 006](./006%20-%20Replicate%20changes%20between%20staging%20and%20prod%20RFC.md) and create a how-to guide in the documentation much like the guide on [how to replicate changes across infra environments](https://iasql.com/docs/envs/) along with an example repository that walks users through how to code review their changes using **convention over configuration** such that the workflow:
- works with any cloud identity and access management structure
- works with IaSQL schema upgrades
- works with any source control solution without the need for special access to it
- preserves the ability to `iasql_preview` changes in development and get the type-safety feedback from the dashboard editor

The workflow simply suggests users run `iasql_begin`, perform all the necessary changes, and before doing `iasql_commit` they put the output of `iasql_preview` and the SQL generated thus far into a file within a repository of their liking. Once the PR is approved by their peers and landed, they can manually run `iasql_commit`. We can require a parameter for `iasql_commit(message)` which is a string attached as metadata for the transaction that can be set to be the PR URL. Best practices are thus enforced using convention and not configuration with a complete reference of what was done via the IaSQL audit log if necessary.

The required work in the IaSQL engine is associating entries in the audit log with specific transactions and adding a `get_sql_for_transaction()` that returns the SQL for the current transaction so users don't have to provide a timestamp for `get_sql_since()`. To formalize the convention, it would be pretty easy to do a pure pl/pgsql function `iasql_create_review(title text, description text)` function that internally creates the context of the markdown file consisting of the title and description of the change, followed by ```sql and <table> formatted blocks powered by get_sql_for_transaction() and iasql_preview(). Then they just have to copy-paste this into GitHub or whatever version control system their team uses. The documentation can describe what it's doing under the hood with these two functions but reduce the friction involved in formatting the output for consumption.

Down the line, we can revisit another alternative for a longer-term implementation and/or automate different parts of the convention for this workflow when we have more data points and resources. It might be as simple as adding a job template in each CI platform that only requires a Postgres connection string and can be triggered manually within the CI/CD to open a PR with the details of the current transaction.

## Alternatives Considered that don't require multi-user

The options laid out in this section unblock peer review of infra changes without implementing multi-user which we eventually want to implement, but it brings quite a bit of cloud-specific complexity/scope that would make an iterative implementation that works for most users difficult.

The biggest question about how multi-user would work depends on whether a company/organization would have an IaSQL database per root cloud account or IAM/user role. In other words, would they use the privileges/permissions in Postgres or the existing ones that have already been created in the cloud? For example, if a company has a single root account with all of the infrastructure and an IAM user per employee it would be doable, but complex, to allow them to preserve the current cloud permission structure while allowing multiple users. Furthermore, this might vary per company.

### IaSQL-compliant CLI data migration system

Implement an external, lightweight SQL migration system. The migration system would be in its own public repository, such that it could be used separately from IaSQL. The feature set for the initial MVP version:
- A downloadable CLI with a single `migrate` command that works with Linux, so it is compatible with CI/CD
- Support PostgreSQL 14
- Support `up` versioned migrations with the following format `migrations/V0__********.sql`, `migrations/V1__********.sql`
- Be able to baseline migrations from a given migration so running `migrate` ignores migrations before a given version.
- Three config values are provided to `migrate` through environment variables: baseline version (defaults to 0), migration folder location (defaults to `migrations/` in the current directory), and a required PostgreSQL connection string

Pros: 
- This option does not require implementing multi-user or a GitHub provider. We also have a decent amount of experience building CLIs in Rust.
- This option requires little user education. UX is similar to what people expect in a traditional database workflow akin to how we converged on transactions over IaC's `apply`.
- Less surface area for things going wrong since the current transaction workflow does not change.

Cons: 
- Migration files are static so there is no data model feedback and it is not possible to look at `iasql_preview` as you develop. This can be sidestepped by suggesting users do `iasql_begin`, write SQL, `iasql_preview`, `get_sql_since`, and then `iasql_rollback` at the cost of adding noise to the IaSQL audit log.
- The user has to remember to baseline migrations after every `iasql_ugprade`.
- There needs to be IaSQL configuration exposed to the user to preserve migration tables on schema upgrades, but we can set the defaults in both places accordingly.

### IaSQL-specific CLI data migration system

Implement a built-in, lightweight SQL migration system that maps a transaction to a migration file. The feature set for the initial MVP version is similar to the IaSQL-compliant CLI data migration system except that versioned migrations have the following format: `migrations/V013/M__********.sql`, `migrations/V014/M__********.sql`.

Pros: same as IaSQL-compliant CLI data migration system option.

Cons:
- Migration files are static so there is no data model feedback and it is not possible to look at `iasql_preview` as you develop. This can be sidestepped by suggesting users do `iasql_begin`, write SQL, `iasql_preview`, `get_sql_since`, and then `iasql_rollback` at the cost of adding noise to the IaSQL audit log.
- Potential for feature creep over time in this IaSQL CLI and more surface area of things to maintain in the core of the product.

### GitHub provider and full SQL data migration system

We introduce an `iasql_migrations` table that is preserved across IaSQL schema upgrades and introduce an `iasql_migrate` PG function. The `iasql_migrations` table does not have the SQL of the migrations but instead points to a remote git repository that the GitHub provider grants access to and some form of a `github_review module` that *somehow* provides `iasql_migrate` with the files in the repository or vice-versa.

### Flyway Premium

Paying for Flyway’s premium version and suggesting that IaSQL users do so too which is a tall order. Additionally, Flyway has many quirks due to the plethora of features it has accrued of which IaSQL users only need a minimal subset of them. Not an alternative, but listing it anyways.

### `iasql_transaction_review` table convention

Another alternative is creating a very basic `iasql_transaction_review` table (or something like that) where the metadata to review/approve/comment the transaction is stored in there. The actual review by 3rd parties is not validated by IaSQL but operates on the honor system. This is similar to the multi-user alternatives below, but without the GitHub integration nor any explicit multi-user management

In many ways, it is the same as the proposal and could be added later on since in the proposed solution there's nothing to block users from still `iasql_commit`ing a transaction that had its review rejected in GitHub.

## Alternatives Considered that require multi-user

### GitHub module and `iasql_review` module to peer review a transaction natively in IaSQL

`iasql_review_changes()` function that would grab the audit log records starting from the current transaction, generate the SQL, generate the execution preview, and save all of that into a new table (that would only need three columns `id: int, sql: text, expected_operations: json`), then it would `iasql_revert()` to before the transaction started and return the ID as the output.

Others users can call `iasql_view_changes(id)` to get the change in question and see it displayed in their own SQL connection, and then you can either `iasql_reject_changes(id)` (which would delete the row from the table) or `iasql_approve_changes(id)` (which would start a new transaction, run the SQL, then `iasql_commit()` it).

There can be a fifth function that bakes in Github support `iasql_pr_changes(id, gh_repo, gh_pat)` to auto-generate a github PR with the description being a markdown version of the `iasql_view_changes` output, and merging the PR *somehow* securely calls `iasql_approve_changes(id)`, but not sure how much extra work that would be, and there's a bunch of weirdness around that PR getting out-of-sync with the database if someone calls `iasql_reject_changes(id)` directly in the database and someone else later merges the PR, so I'm less into that one as written (but perhaps it could be refined into something better, and maybe even inclusive to Gitlab and others?)

Pros:
- No CLI to create or maintain.

Cons:
- Requires multi-user
- There might be security concerns related to providing a PAT for GitHub that would add friction or make this a non-starter for some.
- Gitlab and users on other source control hosting will not be supported or require adding new providers

## Expected Semver Impact

None

## Affected Components

None

## Expected Timeline

The first MVP version should be ready to dogfood within a week.
