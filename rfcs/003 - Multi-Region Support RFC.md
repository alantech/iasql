# 003 - Multi-Region Suppor RFC

## Current Status

### Proposed

2022-08-22

### Accepted

YYYY-MM-DD

#### Approvers

- Luis Fernando de Pombo <l@iasql.com>
- Alejandro Guillen <alejandro@iasql.com>
- Yolanda Robla <yolanda@iasql.com>

### Implementation

- [ ] Implemented: [One or more PRs](https://github.com/iasql/iasql-engine/some-pr-link-here) YYYY-MM-DD
- [ ] Revoked/Superceded by: [RFC ###](./000 - RFC Template.md) YYYY-MM-DD

## Author(s)

- David Ellis <david@iasql.com>

## Summary

Due to the structure of the AWS API, as well as some hesitance to accidentally over-complicate our tables, we implemented the root `aws_account` module to require a specific AWS Region to be chosen for the database. Thus to manage your entire AWS account you would need a separate database for every region you're using, and be careful not to install modules for services that are "global" in scope like Route53 on more than one of these databases. It is also impossible to safely represent cross-region entities like DynamoDB clusters. This is an untenable situation for IaSQL for serious usage, and so enabling management across all regions within a single database must be tackled.

## Proposal

After going through several options in many directions, we've chosen adding a `region` column to all relevant tables, but with a `default` value provided in the schema so users can normally ignore that column if they deploy primarily to just one region.

In order to keep the current flexibility, there would be a Postgres function provided by the `aws_account` module to return the default region they have selected. This could simply be a rename of the current `region` column on the `aws_account` table to `default_region`, but we also want to improve on the current state of things when moving to multi-region modules.

The first thing that we desire is that the default region be guaranteed to be an actual region that the user is able to access. That depends on their credentials, so we should have an `aws_regions` table contains the list of all regions that we acquire via the API, and then joined in on the `default_region` column.

The second thing that is necessary with this approach is that the default region function output needs to always return a region.

These two are not compatible with each other, and here's why:

If we put a foreign key join on the `aws_account` table to the `aws_regions` table, then when we first attempt to insert the credentials to make it available to the Mapper in charge of the `aws_regions` table, we would have to have the `default_region` be set to `NULL` to not fall afoul of the foreign key constraints. But if it is `NULL` then the default value function would need to have some other value it always spits out to users which we don't *know* for sure could be something like `us-east-1` because it depends on the response for the regions available to the credentials in question.

There's also a third desire for this refactoring: we want to go multi-region, but we also want to allow users to disable regions that they do not use (or do not want to manage with IaSQL) to improve the performance of `apply` and `sync` operations.

I bring this up because it suggests a solution for both problems.

We split the `aws_account` into two tables, `aws_credentials` and `aws_regions`. The credentials table *only* has the credentials for the AWS account, while the `aws_regions` table has three columns, the `region`, `is_default`, and `is_enabled`, with the last two being boolean columns and the `is_default` column having a constraint that only one row has a default value.

When first populating the `aws_regions` table, all regions returned that the user has access to should be enabled by default, and the first one is set as the default. We can then overload the `aws_default_region` function we intend to use for reading the default region to also perform the necessary operations to alter the default region (this requires temporarily disabling the constraint on the table only allowing one `is_default == true` row, making the current default `false`, then setting the new default to `true` and re-enabling the constraint within a transaction).

Within the `AwsAccount` object in the engine itself, it currently attaches a `getAwsClient` method to the context object that the other modules use. This should continue to maintain the current behavior it has when no arguments are passed to it, returning a client tied to the default region, which will allow existing modules to be converted to region-aware over time.

There should also be a new function to `getEnabledAwsRegions` and `getAwsClient` should be overloaded to accept a region argument to override the default.

The cloud read functions would need to be updated to first `getEnabledAwsRegions` and then loop their current logic per region received. Cloud create/update/delete would use their own entity's `region` column to determine the value to pass to the `getAwsClient` function.

### Alternatives Considered

#### `region` columns on all relevant tables

The simplest solution is to just slap a `region` column onto every table that is region-specific and cloud reads cycle through all regions every time.

##### Pros

1. We can implement this piecemeal, module-by-module ignoring the `region` column in the `aws_account` and doing their own thing.
2. Very clear where resources are located.
3. Could have a `regions` table in the `aws_account` that lists only regions your account has access to, and these can all be FKs for safety.

##### Cons

1. Creating records becomes more cumbersome with explicit regions all over the place.
2. Cloud Reads likely become 20x slower than they currently are with sequential reads across all regions.
3. Auto-populated tables from AWS become filled with records where the vast majority are "irrelevant" for most users (which default security group is *my* default security group?)

#### Regions as schema names

Instead of using the `public` schema, we could have each region be a [schema](https://www.postgresql.org/docs/current/ddl-schemas.html) (plus a `global` schema for non-region-based tables) and the user can `SET search_path TO us_west_2;` and continue using the exact same queries they have so far.

##### Pros

1. No changes to the relationships between the mappers in the modules, just a mechanism in the client to figure out which schema is involved to populate the region in the AWS client.
2. Users can specify a preference for one region or another by just making that region's schema their default search path.

##### Cons

1. The same cloud read performance issue as the region-column approach.
2. Cross-schema joins may be impossible, or very awkward, for things like a DynamoDB cluster.
3. The set of regions can't be dynamic in this approach without some very tricky changes in the engine to re-apply the "install" operations on the newly-discovered region.
4. More mangling of TypeORM to toggle the schema the entities are in (though this is likely not too complicated).

#### Regions as table prefixes

Similar to the prior one, but instead of `us_west_2.security_groups` it would be `public.us_west_2_security_groups`.

##### Pros

1. Every table is immediately visible unlike the regions-as-schema-names approach.

##### Cons

1. TypeORM entity logic needs trickery to take a single logical entity and map it to several similarly-named entities, and then somehow inform the mapper of what trickery was used for which instance.
2. You can't hide regions you don't care about, and every query has to be altered.

#### `Region` mega-join table

A specialized join table that contains `table`, `column`, `value`, and `region` columns to uniquely identify *any* row of any table and specify the region that applies to it. For rows that don't have a record in there, a `default_region` column in the `aws_account` would be assumed to be the answer if it is relevant. There could also be a list of `active_regions` that can trim the AWS API access to only regions the user is interested in.

##### Pros

1. Also requires zero schema changes to other modules, can be done in a single shot.
2. Preserves the "default region" concept to keep inserts effectively identical.
3. Can actually be faster by cutting out irrelevant regions.

##### Cons

1. Joins would be very slow and meta, with no good way to guarantee correctness as the joins will not be enforced by Postgres, but only us.
2. Inserts for non-default regions are all two-step, and *must* be explicitly done before `iasql_apply` or it will accidentally create in the wrong region.
3. Querying what's in what region will be much tougher than other options.

#### Region-prefixed-to-@cloudId-column

The IaSQL `@cloudId` concept (an ID that isn't the autogenerated database ID, but the ID the cloud provider generates once the resource is created) can double-up as the region indicator, when necessary. On insert you insert the region in question, and once it is created in the cloud, it it set to `region:cloudId` in the column.

##### Pros

1. This also requires no schema changes and can be updated over time.
2. Could similarly have a `default_region` and `active_regions` concept like the mega-join table to gain its benefits.

##### Cons

1. Querying the records by region will be complicated with string prefix checking, so can never be performant, and also varies entity-by-entity.
2. The cloud ID itself similarly would need to be parsed out to find the relevant part of the string, and so joins between entities *on* the cloudId become weirder.

#### Optional region column on relevant tables

Coming full circle on this, we can improve on the first option in this list by taking the `default_region` and `active_regions` idea from the prior two options and applying that to it.

##### Pros

1. Inserts *can* stay the same and not specify a region, with the mappers automatically assuming the default region in question.
2. It can also be migrated to over time.

##### Cons

1. Nulling-out the region column after it has been populated can have unpredictable results, and is easier to accidentally do than the prior option.
2. Most every entity needs to be altered.

## Expected Semver Impact

If we were post-1.0.0, this would be a major version change, no matter what option we take.

## Affected Components

All of the current `aws_*` modules, but that should be it, no significant architectural changes outside of them.

## Expected Timeline

The changes to `aws_account` should take a day or two, and then the rest of the modules can be ported over from single-region to multi-region over time with no backwards compatibility problems. Once that's done, multi-region features can begin development, so likely just a week or two to finish this RFC.
