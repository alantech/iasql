# Contributing

Thanks for your interest in helping improve IaSQL! 🎉

If you are looking for IaSQL's documentation, go here instead: https://docs.iasql.com/

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

IaSQL treats infrastructure as data by maintaining a 2-way connection between a cloud account and a PostgreSQL database. IaSQL is an eventually-consistent design where the SQL tables are the source of truth. This means that the state that users create in the SQL tables is what things will be pushed towards, *not* reading the state from the cloud and exposing it to end users for querying. It's eventually consistent so multiple changes can be queued up without latency on the user's side and any difference between reality and what's in the tables will be treated as an issue to be corrected and a cloud migration to perform.

There are a couple of places (like security group IDs) where we can't avoid the ID being generated by the cloud instead of ourselves within postgres. These will need to be nullable columns that we eventually fill in once the security group is created during the creation process. Similarly, things that depend on other things with nullable columns will fail if that column is still null, so `is not null` checks should be included in the queries involving them, though this isn't a hard requirement, as it being null will just cause the API call to fail (but better to not do that when we know it won't work in the first place).

## How to run IaSQL locally

This repo houses the IaSQL engine which is a Node.js HTTP server written in Typescript. Make sure docker is installed locally and bring up the Postgres engine and Node.js server by running

```
IASQL_ENV=local docker-compose up --build
```

For Windows you can use below command:

```
$env:IASQL_ENV = 'local'; docker-compose up --build
```

`IASQL_ENV=local` configures the engine to use the values from `src/config/local.ts`. The Postgres superadmin user will be `postgres` and its password `test`. The Node.js server will start on port 8088. To create a new database in your local Postgres engine and connect it to an AWS account (and whatever region you prefer) send the following HTTP request to the local engine:

```bash
curl http://localhost:8088/v1/db/connect/db_name
```

Now connecting to the database is a simple as:

```bash
psql postgres://postgres:test@127.0.0.1:5432/db_name
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
curl http://localhost:8088/v1/db/disconnect/db_name
```

## How to develop IaSQL

Instead of a centralized linear list of migrations, we have a module-based approach to allow different collections of tables to be inserted or removed as desired by the end users. These modules need to declare what modules they depend on and what resources (tables, stored procedures, etc) they depend on.

Development of a new module is expected to follow this pattern:

1. Create the module directory inside the latest version directory, and create `entity` and `migration` directories inside of it.
2. Create the entity or entities in the `entity` directory and export them all from the `index.ts` file (or just define them in there).
3. Run the `yarn gen-module my_new_module_name my_new_module_version` script and have it generate the migration file. (`my_new_module_name` needs to match the directory name for the module in question and `my_new_module_version` needs to match the module's parent directory.)
4. Write the module's `index.ts` file. It must implement the `MapperInterface` inside of `modules/interfaces.ts`, which also requires importing and constructing `Mapper` and `Crud` objects.

Development of an existing module is expected to follow this pattern:

1. Make the changes to the entities that you want to make.
2. Run the `yarn gen-module my_existing_module_name my_existing_module_version` script and have it generate a new migration file. (`my_existing_module_name` needs to match the directory name for the module in question and `my_existing_module_version` needs to match the module's parent directory.)
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

Run `yarn coverage:local` which will set the `IASQL_ENV` to `test` for you. To run a specific test file only, simply pass it as a parameter `yarn coverage:local test/modules/aws-cloudwatch-integration.ts`

## How to test IaSQL via CI

### Common integration

Common tests are inside `test/common/` directory. This tests run sequentially and they use the `Testing` account. To add a new test just create the file inside the common directory and it will run automatically.

### Modules

Modules tests are inside `test/modules/` directory. Currently, every module has a dedicated test account with credentials given via Github Actions secrets and every test run picks an AWS regions within that test account via the [CI setup](https://github.com/iasql/iasql-engine/blob/main/.github/workflows/ci.yml#L84). Modules tests run in parallel with each other but sequentially within each module file and each use a specific account per module to avoid rate limits per account. To add a new test:

- Create the test file inside `test/modules`. The current pattern to name the file is `aws-<aws-service>-integration`.
- Create a new AWS account under the `iasql` organization:
  
  - Add account following the same pattern for the name `aws-<aws-service>-integration` and the email `dev+aws-<aws-service>-integration`.
  - Move the account to the Integration testing organization Unit. This way all the resources created by these accounts will be isolated and unrrelated to the other environments.
  - Reset password for the account
  - Generate account credentials

- Save account credentials as Github actions secret. The name of the secrets should follow the pattern:
  
  - `AWS_ACCESS_KEY_ID_<name of the test file in uppercase and replacing - with _>`
  - `AWS_SECRET_ACCESS_KEY_<name of the test file in uppercase and replacing - with _>`

- Run the tests. It will parallelize the test file and use the new credentials automatically.

## How to release IaSQL via CI

IaSQL has a rolling release schedule for it's modules. The last 4 versions (1 month's worth) of modules are supported at any point in time, so users have a monthly cadence to upgrade their databases to the latest version. In order to allow for hotfixes to be deployed mid-release, during the development of the next version, it is not yet marked as the actual latest version and is transitioned when ready.

The flow for any given development cycle is as follows:

### 1. Begin development of the next version

Go to the [Actions tab](https://github.com/iasql/iasql-engine/actions) and click the "Develop New Version" tab. Next click the "Run Workflow" button. Then type in the new version number for the next release and finally click the green "Run workflow" button.

### 2. Develop!

Write PRs and merge them as you normally would.

### 3. Drop the old version

Go to the Actions tab and click the "Drop Old Version" tab. Then click the "Run Workflow" button to drop the oldest, no-longer-supported version.

### 4. Release the newest version

Go to the Actions tab and click the "Release Newest Version" tab. Then click the "Run Workflow" button to mark the newest version as released.

### 5. GOTO 1.

## `apply` and `sync` Behavior

This is an overview of how the `iasql-engine` detects changes in your database and/or cloud and performs operations to make them the same (in one direction or the other). This assumes knowledge of [`apply` and `sync`](https://docs.iasql.com/apply-and-sync) at the high level, software development in general and some familiarity with the `iasql-engine` codebase in particular, though it links to relevant pieces when they are being discussed.

<!-- TODO: Diagrams, diagrams, diagrams! -->

### Terminology

* **CRUD** - *C*reate *R*ead *U*pdate *D*elete. The four basic operations to manipulate data.
* **Entities** - Object-oriented representations of database table(s) *and* cloud services
* **Mappers** - A collection of CRUD functions for an entity to manipulate an entity from the database into the equivalent cloud service object *or* from that cloud service into the database.
* **Identity** - Some usually simple unique piece of data that can distinguish one entity from another
* **Differ** - A function that can determine if two entities are actually different
* **Promise** - A special type of object that is a reference to an asynchronous task that will eventually execute and will either pass or fail at some point in time in the future.
* **Dependency Graph** - A graph data structure used to determine what things need to be done before the node in question can be executed
* **Module** - A collection of closely-related functions/objects/data that can be installed and uninstalled independently, though they may or may not depend on other modules
* **Eventual Consistency** - A technique where desired operations are executed asynchronously and the time/order of achieving the final desired outcome is not known/knowable ahead of time.

### Read-Diff-Execute Loop

The [`apply`](https://github.com/iasql/iasql-engine/blob/main/src/services/iasql.ts#L310) and [`sync`](https://github.com/iasql/iasql-engine/blob/main/src/services/iasql.ts#L527) functions are very similar dual `do-while` loops that execute the following steps:

1. For every `mapper` that exists in the database, load all database records into their associated `entities` using the database Read function from the `mapper`.
2. Repeat this process for the cloud, by using the cloud Read functions from the `mapper`s.
3. For each `mapper`, generate the IDs for all database and cloud entities and intersect these two sets to produce three new sets: entities only in the database, entities only in the cloud, and entities in both.
4. For the set of entities in both, execute an entity diffing function using the `mapper`'s `equals` method to determine which of the entities in both database and cloud are the same, and which have differences. Then discard the entities that are the same, leaving a set of entities that have changed.
5. Convert these sets into actions to take. Specifically, argument-less functions that when called return a new Promise to perform the action, so it may be called again if failed but *suspected* to be able to succeed in the future. The way the sets are converted into tasks depends on whether this is an `apply` or a `sync`. On `apply` entities only in the database become cloud creates, while entities only in the cloud become cloud deletes, and entities changed become cloud updates. For `sync` entities only in the database become database deletes, entities only in the cloud become database creates, and entities changed become database updates.
6. Try to [run all of these promises and keep track of which ones succeeded and which failed](https://github.com/iasql/iasql-engine/blob/main/src/services/lazy-dep.ts#L13). If there are any errors, and the number of errors is *different* from the last execution, then re-schedule the errored-out tasks and try to run them again, until either the failure mode is consistent or every task has succeeded. This approach allows the implicit dependency graph between tasks to execute settle out naturally without needing an explicit dependency graph. (The module dependency graph and operation types are used to roughly sort them, but because some AWS services have cycles in their dependencies, a traditional DAG-to-list algorithm can't be relied on).
7. If this is `apply` reload only the *cloud* state, while if this is `sync` reload only the *database* state, and repeat from step 3. If there is no more work detected to be done, then repeat again from step 1. If there is *again* no work to be done, we're finally finished. This last "step" is tricky and why it's a double `do-while` loop to implement things. Read on below for more on why this is.

### Why does Step 7 exist?

If we were updating/synchronizing between two different databases, Step 7 is 100% not necessary and you can handle everything without any looping (beyond the task transient error handling loop in step 6).

This is because in the database everything is mutable. But the cloud is not exactly like that. Some cloud entities cannot be changed after they have been created. They can only be replaced. You also can't just issue a delete and then an insert, because other entities that depend on the entity you're trying to replace are still there and the delete operation on your current entity will not eliminate those other entities, but will instead error out.

What you need to do is only create a new entity that matches the database, and then on the next loop it will notice that it should delete the entity that isn't in the database and the *other* entities will notice that they are associated with the wrong entity and trigger their own update or replace to swap to the new entity you just created. These tasks will potentially clash with each other but the error-retrying-loop should eventually execute them in the correct order and you're done.

That explains one loop, so why the other? Because of create-only entities that *also* have unique constraints on one or more properties. The AWS Security Group qualifies as one of these. Once you create a security group and set its description, you can't change it, but in IaSQL you certain can do so. If you update the description, which is not unique, but leave the name alone, which is unique, you can't just create a replacement security group with the same name. So the security group mapper has to do something gnarly here. When it creates the replacement, it mutates the name to a randomly generated one and then mutates the internal cache of the DB record to match that randomly generated name.

Now when it does this replace, it first sees that it is supposed to mutate the security group description without mutating the name but alters the name in its cache and executes a cloud create with this new, fake record. Then the inner loop runs and entities connected to the security group "realize" they are on the wrong security group and switch to this new, temporary security group, while the old security group with the correct name is marked as cloud-only so it is deleted. Then the inner loop completes with no difference between the database *cache* and the cloud, so it goes back to the outer loop, which re-loads the *actual* database state and it checks again and sees that there's a security group in the database that is not in the cloud and a security group in the cloud that is not in the database, and that these other entities are connected to the wrong security group, so it creates tasks to create a security group, delete a security group, and switch security groups. The error-retrying-loop will execute these tasks some unknown number of times, but the successes will always be in the same order -> create security group -> switch other entities to that security group -> delete the temporary security group.

This dance is necessary to give users in IaSQL the ability to migrate from *any* cloud state to the state they have defined in their database. This is IaSQL's superpower: bringing a greater reliability to producing the cloud state the developer specifies, so they can worry about more important things.

## Module Mapper Footguns

This section will change much more frequently compared to the sections above.

* TypeORM sometimes violates the entity types you have provided, especially around nullable types, where the entity may be something like `foo?: string` which implies `string | undefined` but TypeORM will treat it as `string | null`. This can trip you up in the `equals` function as `Object.is` distinguishes between `undefined` and `null` so you will run into infinite `update` loops where it is detecting a difference but there is no actionable change to be had. [We currently re-adjust TypeORM output after to read or writes to the database to avoid this](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.15/aws_security_group/entity/index.ts#L51-L59). (Similarly sometimes arrays are actually unordered sets, so comparing array element-by-element is incorrect and you need to check each element is inside of the other array, regardless of order, and some strings are actually JSON or other human-editable data formats and non-significant-whitespace differences can also cause `update` loops.
* Deeply-nested entities get translated into many tables in TypeORM, and unique constraints on those tables can cause lots of pain with the entities that were generated from the cloud APIs, as they don't have the the database-only columns that let TypeORM know when the entity already exists in the database. Unfortunately for now you have to manually find these duplicates and then patch your sub-entity with these DB-only fields or the DB CRUD operations will blow up in your face.
* Picking the right field for the `@cloudId` in order to both: 1) properly distinguish records in the cloud and 2) still support distinguishing records in the database can sometimes be a difficult job, particularly if the only real candidate is a cloud-generated property.
* Records that are actually really read-only from the cloud and can't actually be mutated by end users (but are still useful to have to make inserts/updates of other entities safer via join logic) need to have weirdly "backwards" cloud CRUD functions that grab the cloud cache record and re-save it to the database (or delete the user-inserted entity outright).
* The create-only/create-only-with-unique-columns entities currently require [100% type-unsafe actions to manipulate the DB cache](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.15/aws_security_group/index.ts#L171). There are other sections of the codebase where type safety / guarding by the compiler is broken, but this is the worst/most-dangerous one.
* When an entity depends on another entity, it is *best* to join it on a database ID rather any string ID preferred by the cloud. This is because then updates to that string ID are automatically picked up by the mappers of the other entities to perform an update automatically with minimal fuss for the user of IaSQL *and* reduced iterations inside of the engine itself. The second-best choice is to use a string ID that is defined by the user, not the cloud, so if they want to change that identifier, they will at least get a database foreign key error from it and have to themselves first un-join the entities in question, make the change, and then join them back. Making the join column a cloud-generated ID means any time there's a `replace`-style update occurring anything that joins on it will simply *break* and IaSQL will not be able to figure out how to stitch things back together so **don't do that.**

There are probably many other footguns at the moment, feel free to update this with any you can think of!

## How IaSQL PostgreSQL functions work

IaSQL [functions or operations](https://docs.iasql.com/function) like `iasql_install(..)`, `iasql_sync()`, `iasql_apply()` are required to provide a synchronous user experience within a PostgreSQL connection such that the user can't accidentally alter data in tables while an `apply` is taking place whilst still implementing the majority of the logic behind the operations in Node.js. It is worth pointing out that fulfilling this requirement doesn't stop someone from opening two simultaneous connections to the same database or creating two databases pointing to the same cloud account. It just makes it so it doesn't happen by accident when using the product as expected.

[Graphile worker](https://github.com/graphile/worker) is a job queue that runs on PostgreSQL + Node.js. At startup, the Node.js engine looks at its [metadata repository](https://github.com/iasql/iasql-engine/blob/main/src/entity/index.ts) which stores information about all the IaSQL databases the engine is managing so it can spin up a graphile worker per existing IaSQL database and put it into it's own Node.js child process to avoid clogging up the event loop. New databases created via the `/connect` route get a new metadata repo entry and Graphile worker within a child process. Workers are initiated and defined in the [scheduler.ts](https://github.com/iasql/iasql-engine/blob/main/src/services/scheduler.ts) to implement an RPC in which the IaSQL functions in SQL can call into the actual logic of operations that live in the Node.js engine. The PG SQL functions poll until the Node.js code is done via the [`iasql_operation`](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.18/iasql_functions/entity/index.ts) table which is used to keep the output, the state, and the finish time for every operation in that database. The `until_iasql_operation` PG SQL function is ultimately called by every IaSQL function and is what kicks off the polling. This function invokes the Node.js code via Graphile worker by using `graphile_worker.add_job(...)` and then creates a while loop watching for the `end_time` column in `iasql_operation` table to wait for the result of the Node.js code.

![](https://user-images.githubusercontent.com/5357435/185755422-84c7c9d2-f5e4-4c6f-8a16-ef8d7601644f.png)

However, PostgreSQL does not support autonomous transactions and all PG functions run within a transaction. An autonomous transaction is an independent transaction run within a parent transaction that must be committed or rolled back before the parent transaction is finished. This makes it such that PostgreSQL does not allow, within a single transaction, to poll for the result of another process. We get around this in PostgreSQL by using a whole new connection via dblink as described [here](https://aws.amazon.com/blogs/database/migrating-oracle-autonomous-transactions-to-postgresql/). We keep a [dblink server](https://github.com/iasql/iasql-engine/blob/main/src/services/scheduler.ts#L29) per database with the extra connection that we can re-use for polling. This is how we are able to keep a synchronous UX with a vanilla Postgres instance without any extensions for the time being.