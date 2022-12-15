# 006 - Sync changes across databases RFC

### Proposed

2022-12-15

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

- Luis Fernando De Pombo <luisfer@iasql.com>

## Summary

An IaSQL database connects to a cloud account and automatically backfills it with what is already in the cloud account during the initial onboarding and keeps it up to date over time. However, once you import your staging *and* production cloud accounts to two different databases it is not clear how to make changes to both or keep them in sync. The common workflow is to make changes to your staging deployment and then replicate the changes to your production deployment. One of the appeals of SDK-based IaC tools like Pulumi is that you can apply the blueprint like a hammer with some parametrization. This is also possible in Terraform with HCL, but it is a bit more clunky.

We have leaned deeper into the infrastructure as data workflow by dropping migrations from our deployments and favoring two-way mode with transactions over IaC’s apply. This plays to our strengths and provides a compelling workflow to manage infrastructure. However, we need a good story to import or replicate changes from one database to the other since most people manage staging and production as separate cloud accounts.

One important requirement to keep in mind is being able to exclude certain resources from this special sync. In other words, there might be resources in staging that people don't want to replicate in production and vice versa. This requirement can be sidestepped initially, but whatever design we pick should be able to support this down the line.

## Proposal

TBD

## Alternatives Considered

There are several types of solutions to replicate staging infrastructure changes in production.

### Dump a database and import the dump into another database

An `export` route in the engine implemented using `pgdump` with logic to attempt to make it generic like excluding `aws_account` from the dump and so on. The dump is then intended to be passed into an `import` route for another database. `import` was deprecated for the time being due to the sheer amount of special-casing, which compounded per module, that had to be built within the functionality of export and import.

### "Sync" a database to a different cloud account than the one it is connected to

An IaSQL function that takes the alias of another dataabse owned by the same user as input. `iasql_import(‘staging’)` will return the same data structure as `iasql_commit` or `iasql_preview`. This function can reuse parts of the mappers and existing IaSQL functions to run diffs across two different databases or accounts. There could have an optional `dry_run` parameter or another function to preview the changes: `iasql_preview_import(‘staging’)` or `iasql_import(‘staging’, true)`.

The steps to replicate recent database/account A changes in database/account B when calling `iasql_import('A')` from within database B:
1) Regular sync database A to cloud account A
2) Regular sync database B to cloud account B
3) New import sync functionality where database B is pointed to cloud account A directly

The new import sync functionality described in #3 would expand the mapper definitions to include a new `import` function and laxer equality function for each module.

### Use existing PostgreSQL data synchronization tools

There is a breadth of tools to keep two databases in sync. However, they are not enough to satisfy our requirements for this problem because the data should not be copied over exactly as-is. We have cloud-generated IDs as columns in a lot of tables that are specific to a resource in each account like an EC2 instance id.

### Emulate a declaration via ORMs with introspection + Upserts

Lean on ORMs with introspection and upserts to generate code akin to an SDK-like IaC declaration. This is not a viable option. Deletions are not truly idempotent as IaSQL has no way of knowing what upserts were added or removed from the declaration script.
