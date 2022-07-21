# 002 - Custom Modules Functions RFC

## Current Status

### Proposed

2022-07-21

### Accepted

YYYY-MM-DD

#### Approvers

- Luisfer De Pombo <luisfer@iasql.com>
- Alejandro Guillen <alejandro@iasql.com>
- Yolanda Robla <yolanda@iasql.com>

### Implementation

- [ ] Implemented: [One or more PRs](https://github.com/iasql/iasql-engine/some-pr-link-here) YYYY-MM-DD
- [ ] Revoked/Superceded by: [RFC ###](./000 - RFC Template.md) YYYY-MM-DD

## Author(s)

- David Ellis <david@iasql.com>

## Summary

There are situations where the best (or only) way a module can provide a good experience for the service in question is via a custom Postgres function that is under-the-hood bound to behavior within the `iasql-engine`. Examples of this include querying DynamoDB/Redis/ElasticSearch/etc from within IaSQL, constructing a Lambda function payload zip from raw sources defined in SQL queries, executing an existing lambda function within a SQL query and operating on its resulting payload, etc.

A mechanism to write custom functions in a generalized way across modules is proposed that will also simplify the logic within the [`scheduler.ts`](../src/services/scheduler.ts) file, along with a proposed Module interface change to shore up an issue that has recurred where custom functions get accidentally dropped from usage when module entity migration generation occurs.

## Proposal

The [`iasql_functions` module](../src/modules/0.0.14/iasql_functions) provides various `iasql_*` functions that under-the-hood are powered by a job processing system defined in [`scheduler.ts`](../src/services/scheduler.ts). This module and the scheduler are uncomfortably coupled via the [`enum` defined in the `iasql_functions` entity](../src/modules/0.0.14/iasql_functions/entity/index.ts) to link [these SQL functions](../src/modules/0.0.14/iasql_functions/sql/create_fns.sql) to [the actual functions](../src/services/iasql.ts) that do the work in question.

This has always been a sore point architecturally as encapsulation of information is broken, and it is not truly possible to adjust the behavior of the functions in question without affecting prior module versions at the same time. It is also very difficult (though not impossible) to introduce new functions because 4 different files across the repository must be updated in sync to do so correctly, and can only be done in a way that would be considered a SemVer minor update, major is completely not allowed.

It is proposed to deprecate/drop the `iasql_operation` entity and associated enum, and create a new graphile worker job type, called `rpc` and a new entity named `iasql_rpc` with no enum. Instead two fields would be added as an "addressing system" of module name and method name, which the module would implement within an `rpc` sub-object where all properties are the method names and the values are async functions that take a `Context` object as the first argument and then any arguments from the SQL side are added as follow-up parameters, all as strings similar to the current `params` array.

The `rpc` job in the `scheduler.ts` file would attempt to find and execute this function within the `rpc` object of the named module, and provide relevant error responses if it could not find the function or the function itself failed in some way or the other. Because this is now generalized, it is also possible to have the Module logic in `interfaces.ts` automatically generate "bindings" in Postgres for these functions without requiring hand-written SQL at all.

This would also allow us to move the majority of the `src/services/iasql.ts` functions into the `iasql_functions` module, allowing behavior changes to happen between version bumps of IaSQL and properly segmenting scope again. We would also [tackle this task](https://github.com/iasql/iasql-engine/issues/1016) on the new `iasql_rpc` entity instead of the `iasql_operation` entity.

On a similar note, the current hand-editing of the migration files to insert custom pure-SQL functions is error prone when the migration is regenerated on entity changes. I propose that we have a similar `sql` sub-type on the modules similar to the old `migration` type that automatically runs whatever custom SQL was given to it after the migration up and before the migration down, to prevent this, treating it sort of like a second migration step, but more ergonomic than having to hand write a TypeORM migration file.

### Alternatives Considered

We could add these features as new operation enum types on an as-needed basis, but this would never work with 3rd party modules, and would keep the strange coupling between components of our codebase in place.

We could simply mark this as out-of-scope for the project, but that is simply too unambitious of an answer to consider. There are very clear uses for three different modules that we can already see, so it does not make sense to close the door on them, especially if the support burden within the module definition is minimal once the new "plumbing" is built.

## Expected Semver Impact

For end-users this would be a `patch`-level change. The new implementation replicates the existing behavior exactly while making future additions of new functions possible, where those new functions are `minor` updates, but built on top of this change and not directly affected.

## Affected Components

This would affect the scheduler, `iasql_functions` module, and the Module `interface.ts` files.

## Expected Timeline

This RPC would be implemented in two phases. The first phase is the "creation" phase, and the second is the "cleanup" phase. The creation phase must be completed within a week and sets up the latest version to use the new system, while the cleanup phase can only be done once this version in question is now the oldest supported version and the old mechanism can be cleared out.

### The "creation" phase

- Add the new `iasql_rpc` entity with auto-vacuum and scheduler task (1-2 days)
- Add the `rpc` and `sql` types and behaviors to the Module interfaces (1 day)
- Copy the `iasql.ts` functions into the `iasql_functions` module, drop the `iasql_operation`-based handwritten functions, and expose the new ones via RPC (1 day)
- Port all hand-edited migration files to use the new `sql` sub-object instead (1 day)

This phase should be doable by a single person in a single release cycle if that is all they are doing that week, or it can be split between exactly two people (the first two tasks can be done in parallel with each other, and once done then the last two tasks can also be done in parallel with each other).

### The "cleanup" phase

- Drop duplicated functions out of `iasql.ts` (1 day)
- Drop the old scheduler `operation` logic (1 day)

Cleanup work is minimal and parallelizable, and should really be doable in just an hour or so for the both of them.
