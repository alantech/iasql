# 007 - Code review infrastructure changes RFC

### Proposed

2022-12-16

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

Eng teams move over from using cloud UIs to IaC because cloud infrastructure changes can lead to outages more often than business logic changes. As a result, it is considered a DevOps best practice to code review infrastructure changes using IaC tools and show the `preview` of the resulting change in pull requests to raise the quality bar and reduce the possibility of mistakes. Cloud infrastructure can be code reviewed with IaSQL using any migration system that supports non-schema, or data, migrations (some ORMs like Prisma only support schema changes) by wrapping each migration in an IaSQL transaction. However, through our research and dogfood efforts of IaSQL we have not found a migration system that fulfills the requirements needed to code review changes with IaSQL:
- Allow data-only migrations
- Allow plain SQL or an introspective ORM
- Be able 
- Free and ideally open source
- Baseline/ignore certain migrations

Data migrations are needed for IaSQL, more so than the traditional schema migrations, and require baselining migrations to avoid duplicate record violations when IaSQL databases are recreated from scratch (e.g. connected and disconnected to the same cloud account) or when changes happen outside of IaSQL and are “synced” from the cloud by the cron job. Flyway comes closest to meeting all our requirements. However, it is not possible to baseline/ignore existing migrations on their free product.

## Proposal

The proposal is to implement a super lightweight, open-source plain SQL migration system in its own public repository, such that it could be used separately without IaSQL. The feature set for the initial MVP version:
- A downloadable CLI with a single `migrate` command that works with Linux, so it is compatible with CI/CD
- Support PostgreSQL 14
- Support `up` versioned migrations with the following format `migrations/V0__********.sql`, `migrations/V1__********.sql`
- Be able to baseline migrations from a given version so running `migrate` ignores migrations before a given version
- Three config values are provided to `migrate` through environment variables: baseline version (defaults to 0), migration folder location (defaults to `migrations/` in the current directory), and a required PostgreSQL connection string

## Alternatives Considered

Paying for Flyway’s paid version and suggesting that IaSQL users do so too. However the product has many quirks due to the plethora of features it has accrued of which IaSQL users only need a minimal subset of them.

## Expected Semver Impact

None

## Affected Components

None

## Expected Timeline

The first MVP version should be ready to dogfood within a week.