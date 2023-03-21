# 008 - Best UX for blocking operations, `iasql_install` and `iasql_commit`, RFC

### Proposed

2023-03-20

### Accepted

YYYY-MM-DD

#### Approvers

- David Ellis <david@iasql.com>
- Yolanda Robla <yolanda@iasql.com>
- Alejandro Guillen <alejandro@iasql.com>
- Mohammad Pabandi <mohammad@iasql.com>

### Implementation

- [ ] Implemented YYYY-MM-DD
- [ ] Revoked/Superceded by: [RFC ###](./000 - RFC Template.md) YYYY-MM-DD

## Author(s)

- Luis Fernando De Pombo <l@iasql.com>

## Summary

IaSQL lets users connect an AWS account to a PostgreSQL DB and automatically backfill the database with existing cloud resources. This is meant to make the onboarding into IaSQL smooth as users don't need to redefine or reconcile existing infrastructure that was previously created via the AWS console or any sort of cloud management tooling. However, importing all existing cloud resources, even for just a single module, can take many minutes. This is exacerbated by users with nontrivial AWS accounts as install times seem to scale linearly with the number of resources involved. For example, if an S3 bucket or ECR repository has several hundred artifacts, it can take a long time to import the metadata for each bucket object or repository image. Reducing the install times is akin to squeezing blood from a stone since we run the risk of hitting the AWS SDK rate limiters on the other end. We need to find a better UX for module installation. Currently, the user waits for several minutes whilst no information is provided other than an animated loader. User feedback is one of the core pillars of good UX and we are failing at it for `iasql_install`, but also `iasql_commit`. Additionally, `iasql_install` is typically the first query that is run so users are not familiar with what a successful query is supposed to look like in the dashboard. We must also be mindful that not all users will go through the dashboard as they are welcome to use whatever PostgreSQL client they prefer. Finally, whatever UX we decide to go with should probably be mirrored in `iasql_uninstall` and `iasql_commit`. Particularly the latter which can also take a long time.

## Proposal

## Alternatives Considered

### Poll for RPC progress

Include a modal or some sort of dialog that includes a message about how we are importing the entire state of the infrastructure and due to AWS SDK rate limiters it might take several minutes. Below this generic message, we can show a somewhat accurate progress bar derived from a linear estimate of the count of resources and an average processing time per resource. This might be possible without introducing WebSockets by tracking some metadata about ongoing RPC calls within the engine either through:

- a new PG function called `rpcs_status` or `ongoing_rpcs` 
- a new `iasql_*` table called `iasql_rpc_progress`
- a new type of entry in the `iasql_audit_log`

Either of these mechanisms can be queried by the dashboard using the existing PG cron functionality to update the progress state of any ongoing installs or commits across the dashboard tabs. This logic could then be replicated to also improve the UX of `iasql_commit`. For users using Postgres clients instead of the dashboard, this ongoing progress is freely available to query.

The progress tracking could be added via:
- The IaSQL RPC functions like `iasql_install` and `iasql_commit` itself so that they register an estimate as they go
- ...

Pros:
- Improves the UX of `iasql_commit` without any additional effort
Cons:
- Additional metadata and metadata generation in the IaSQL platform


### Realtime install progress and detailed logging

Similar to the option above. However, here we bite the bullet and redo the communication between the engine and the dashboard to use a WebSocket, or long-lived HTTP request mechanism, so real-time progress and detailed logging are possible. Install and transaction information about what the IaSQL engine is doing can be streamed and shown in real time.

Pros:
- No additional metadata in `iasql_*`, but progress needs to still be calculated and transmitted on the fly
- We can add detailed database states aside from `ready` and `invalid_creds` such as `transaction_open`, `installing`, `applying`, `syncing`, etc
Cons:
- Adding a WebSocket, or long-lived HTTP request mechanism, between the dashboard and the engine will be a significant architectural change by itself before we even start to implement the real-time progress tracking and logging

### Async install

Modify `iasql_install` so it creates the relevant tables and returns right after. The reading of the AWS state and its mapping to the relevant entities continues to happen in the background.

Pros:
- This option involves the least amount of work
Cons:
- The user can access tables that are being modified by the IaSQL engine which could cause hard to debug or reconcile "merge conflicts". The user could also run conflicting `iasql_install` queries. This argument falls apart under its own weight since currently, we allow users to open and run queries across dashboard tabs, or database connections, which can easily lead to the same issues. To truly consider this a con, we probably shouldn't allow simultaneous queries from dashboard tabs or database connections altogether.
- `iasql_commit`'s UX remains as-is for now

### Frontload module installation and prolong connect

This is not an option since it only works for the dashboard and the problem would persist after `iasql_connect`, but listing it out to be exhaustive.

## Expected Semver Impact

## Affected Components

## Expected Timeline
