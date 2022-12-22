# Contributing

Thanks for your interest in helping improve IaSQL! 🎉

If you are looking for IaSQL's documentation, go here instead: https://iasql.com/docs

This document is for people who want to contribute to IaSQL. There are multiple ways to contribute to the project other than code, such as reporting bugs, creating feature requests, helping other users in online spaces, Discord etc.

Table of contents
=================

  * [Get Involved](#get-involved)
    * [Contributor L1](#contributor-L1)
    * [Contributor L2](#contributor-L2)
  * [How IaSQL works](#how-iasql-works)
  * [How to run IaSQL locally](#how-to-run-iasql-locally)
  * [How to test IaSQL locally](#how-to-test-iasql-locally)
    * [Migrations](#migrations)
  * [How to test IaSQL via CI](#how-to-test-iasql-via-ci)
    * [Common integration tests](#common-integration)
    * [Modules](#modules)
  * [How to release IaSQL via CI](#how-to-release-iasql-via-ci)
  * [`apply` and `sync` Behavior](#apply-and-sync-behavior)
    * [Terminology](#terminology)
    * [Read-Diff-Execute Loop](#read-diff-execute-loop)
    * [Why does Step 7 exist?](#why-does-step-7-exist?)
  * [Module Mapper Footguns](#module-mapper-footguns)
  * [How IaSQL PostgreSQL functions work](#how-iasql-postgresql-functions-work)

## Get Involved

Anyone can become an IaSQL Contributor regardless of skill level, experience, or background. All types of contributions are meaningful. Our membership system was designed to reflect this.

**Anything that supports the IaSQL community is a contribution to the project.** This includes but is not limited to:
  - Submitting (and Merging) a Pull Request
  - Filing a Bug Report or Feature Request
  - Updating Documentation
  - Answering questions about IaSQL on GitHub or Discord
  - Answering questions on Discord, Stack Overflow, Twitter, etc.
  - Blogging, Podcasting, or Livestreaming about IaSQL

## Membership Levels, Roles and Responsibilities

### Contributor L1

Have you done something to contribute to the health, success, or growth of IaSQL? Congratulations, you're officially a contributor!

**Benefits:**
- Contributor status on the [IaSQL Discord server](https://discord.com/invite/yxNBQugGbH)

**Nomination:**
- Self nominate by posting the qualifying contribution in Discord (link preferred).

### Contributor L2 (Committer)

**Contributor L2** membership is reserved for users that have shown a commitment to the continued development of the project through ongoing engagement with the community. At this level, contributors are given push access to the project's GitHub repos and must continue to abide by the project's Contribution Guidelines and Code of Conduct.

Anyone who has made several significant (non-trivial) contributions to IaSQL can become a Contributor in recognition of their work. An example of a "significant contribution" might be:
- ✅ Triaging and supporting non-trivial Discord and GitHub issues
- ✅ Submitting and reviewing non-trivial PRs
- ✅ Submitting and reviewing non-trivial documentation edits (multiple sections/pages)
- ❌ A typo fix, or small documentation edits of only a few sentences

**Responsibilities:**
- May request write access to relevant IaSQL projects.
- GitHub: May work on public branches of the source repository and submit pull requests from that branch to the main branch.
- GitHub: Must submit pull requests for all changes, and have their work reviewed by other members before acceptance into the repository.
- GitHub: May merge pull requests the opened once they have been approved.

**Benefits:**
- Committer status on the [IaSQL Discord server](https://discord.com/invite/yxNBQugGbH)
- IaSQL swag mailed to you!

**Nomination:**
- A nominee will need to show a willingness and ability to participate in the project as a team player.
- Typically, a nominee will need to show that they have an understanding of and alignment with the project, its objectives, and its strategy.
- Nominees are expected to be respectful of every community member and to work collaboratively in the spirit of inclusion.
- Have submitted a minimum of 5 qualifying significant contributions (see list above).
- You can be nominated by any existing Committer or Maintainer.
- Once nominated, there will be a vote by existing Maintainers.

## How IaSQL works

IaSQL treats infrastructure as data by maintaining a 2-way connection between a cloud account and a PostgreSQL database. IaSQL is an eventually-consistent design where changes to the SQL tables are pushed into the cloud and changes from the cloud are pushed into the SQL tables. This means that IaSQL generates a diff between the cloud and the database and then compares to an audit log to determine the source of any found differences and then executes the logic necessary to push the change from the "source" side to the "destination" side. It's eventually consistent so multiple changes can be queued up without latency on the user's side by default, but the changes can be made blocking by entering a transaction-like mode, making the changes to the database, and then committing it, which will block until completion.

There are a couple of places (like security group IDs) where we can't avoid the ID being generated by the cloud instead of ourselves within postgres. These are nullable columns that we eventually fill in once the security group is created during the creation process. Similarly, things that depend on other things with nullable columns will fail if that column is still null, but the engine will automatically re-try failed operations if the set of operations to perform changes between attempts (meaning some forward progress has been made) so inserting security group rules for a security group that has not yet been created will not fail, but may take a bit more time depending on the execution order it determined internally.

## How to run IaSQL locally

This repo houses IaSQL which is a Postgres Docker container with a Node.js sidecar process written in Typescript to give it cloud powers. ☁️  Make sure `docker` is installed locally, then you can build IaSQL with:

```sh
docker build -t iasql:latest .
```

or simply `yarn docker-build` if you have `yarn` installed. You can then run a local IaSQL instance with:

```sh
docker run -p 5432:5432 --name iasql iasql:latest
```

or simply `yarn docker-run` if you have `yarn` installed.

By default, the IaSQL docker is configured to use the values from `src/config/local.ts`. The Postgres superadmin user will be `postgres` and its password `test`. To create a new database in your local Postgres engine and connect it to an AWS account (and whatever region you prefer) send the following SQL query to the 'iasql_metadata' database:

```bash
psql postgres://postgres:test@localhost:5432/iasql_metadata -c "SELECT * FROM iasql_connect('db_name');"
```

This will return the specially-made username and password for your new database. Connecting to the database is a simple as:

```bash
psql postgres://<username>:<password>@127.0.0.1:5432/db_name
```

You are off to the races! You'll likely want to manipulate an AWS account, so you'll want to install the `aws_account` module:

```sql
SELECT * FROM iasql_install('aws_account');
```

And then insert your credentials and AWS region:

```sql
INSERT INTO aws_account (access_key_id, secret_access_key, region)
VALUES ('AKIASOMEKEYHERE', 'somesecrethere', 'us-east-2');
```

If you wish to disconnect the local database from the AWS account and remove it from the engine simply run:

```bash
psql postgres://postgres:test@localhost:5432/iasql_metadata -c "SELECT iasql_disconnect('db_name');"
```

## How to develop IaSQL

Instead of a centralized linear list of migrations, we have a module-based approach to allow different collections of tables to be inserted or removed as desired by the end users. These modules need to declare what modules they depend on and what resources (tables, stored procedures, etc) they depend on.

Development of a new module is expected to follow this pattern:

1. Create the module directory, and create `entity` and `migration` directories inside of it.
2. Create the entity or entities in the `entity` directory and export them all from the `index.ts` file (or just define them in there).
3. Run the `yarn gen-module my_new_module_name` script and have it generate the migration file. (`my_new_module_name` needs to match the directory name for the module in question.)
4. Write the module's `index.ts` file. It must implement the `MapperInterface` inside of `modules/interfaces.ts`, which also requires importing and constructing `Mapper` and `Crud` objects.

Development of an existing module is expected to follow this pattern:

1. Make the changes to the entities that you want to make.
2. Run the `yarn gen-module my_existing_module_name` script and have it generate a new migration file. (`my_existing_module_name` needs to match the directory name for the module in question.)
3. Commit the removal of the old migration and add in the new one. You can only have one migration file per module.

### Migrations

IaSQL's modules require the migration file to either be generated by TypeORM, or to be in that form, which is a typescript file that exports a single class with two methods: an `async up` and an `async down`. They both accept a TypeORM `QueryRunner` object and return nothing. Any usage of this queryRunner as supported by TypeORM is allowed, but the simplest usage is `await queryRunner.query(someSqlString);`.

The `up` defines the creation of the SQL schema necessary for your module, and `down` is the removal of that same schema. If you do not use `yarn gen-module` to create this file, it is up to you to make sure the downgrade path fully removes everything added in the upgrade path.

## How to test IaSQL locally

To run the integration tests locally make sure to point to an existing AWS account by setting the following environment variables.

```
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
```

Run `yarn test:local` which will set the `IASQL_ENV` to `test` for you. To run a specific test file only, simply pass it as a parameter `yarn test:local test/modules/aws-cloudwatch-integration.ts`

## How to test IaSQL via CI

### Common integration

Common tests are inside `test/common/` directory. This tests run sequentially and they use the `Testing` account. To add a new test just create the file inside the common directory and it will run automatically.

### Modules

Modules tests are inside `test/modules/` directory. Currently, every module has a dedicated test account with credentials given via Github Actions secrets and every test run picks an AWS regions within that test account via the [CI setup](https://github.com/iasql/iasql-engine/blob/main/.github/workflows/ci.yml#L84). Modules tests run in parallel with each other but sequentially within each module file and each use a specific account per module to avoid rate limits per account. To add a new test:

- Create the test file inside `test/modules`. The current pattern to name the file is `aws-<aws-service>-integration`.
- Run the tests. It will parallelize the test runs by file.

## How to release IaSQL via CI

### 1. Release the newest version

Go to the Actions tab and click the "Release Newest Version" tab. Then click the "Run Workflow" button to mark the newest version as released.

### 2. Begin development of the next version

Go to the [Actions tab](https://github.com/iasql/iasql-engine/actions) and click the "Develop New Version" tab. Next click the "Run Workflow" button. Then type in the new version number for the next release and finally click the green "Run workflow" button. It will create a commit with that version with a `-beta` appended to it to make it clear this and following commits are not for users to work with directly.

### 3. Develop!

Write PRs and merge them as you normally would.

### 4. GOTO 1.

<!-- TODO: Revive `apply` and `sync` explanation, but for `commit` -->

## Module Mapper Footguns

This section will change much more frequently compared to the other sections.

* TypeORM sometimes violates the entity types you have provided, especially around nullable types, where the entity may be something like `foo?: string` which implies `string | undefined` but TypeORM will treat it as `string | null`. This can trip you up in the `equals` function as `Object.is` distinguishes between `undefined` and `null` so you will run into infinite `update` loops where it is detecting a difference but there is no actionable change to be had. [We currently re-adjust TypeORM output after to read or writes to the database to avoid this](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.15/aws_security_group/entity/index.ts#L51-L59). (Similarly sometimes arrays are actually unordered sets, so comparing array element-by-element is incorrect and you need to check each element is inside of the other array, regardless of order, and some strings are actually JSON or other human-editable data formats and non-significant-whitespace differences can also cause `update` loops.
* Deeply-nested entities get translated into many tables in TypeORM, and unique constraints on those tables can cause lots of pain with the entities that were generated from the cloud APIs, as they don't have the the database-only columns that let TypeORM know when the entity already exists in the database. Unfortunately for now you have to manually find these duplicates and then patch your sub-entity with these DB-only fields or the DB CRUD operations will blow up in your face.
* Picking the right field for the `@cloudId` in order to both: 1) properly distinguish records in the cloud and 2) still support distinguishing records in the database can sometimes be a difficult job, particularly if the only real candidate is a cloud-generated property.
* Records that are actually really read-only from the cloud and can't actually be mutated by end users (but are still useful to have to make inserts/updates of other entities safer via join logic) need to have weirdly "backwards" cloud CRUD functions that grab the cloud cache record and re-save it to the database (or delete the user-inserted entity outright).
* The create-only/create-only-with-unique-columns entities currently require [100% type-unsafe actions to manipulate the DB cache](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.15/aws_security_group/index.ts#L171). There are other sections of the codebase where type safety / guarding by the compiler is broken, but this is the worst/most-dangerous one.
* When an entity depends on another entity, it is *best* to join it on a database ID rather any string ID preferred by the cloud. This is because then updates to that string ID are automatically picked up by the mappers of the other entities to perform an update automatically with minimal fuss for the user of IaSQL *and* reduced iterations inside of the engine itself. The second-best choice is to use a string ID that is defined by the user, not the cloud, so if they want to change that identifier, they will at least get a database foreign key error from it and have to themselves first un-join the entities in question, make the change, and then join them back. Making the join column a cloud-generated ID means any time there's a `replace`-style update occurring anything that joins on it will simply *break* and IaSQL will not be able to figure out how to stitch things back together so **don't do that.**

There are probably many other footguns at the moment, feel free to update this with any you can think of!

<!-- TODO: Revive Postgres function explanation for the new HTTP-based RPC approach -->
