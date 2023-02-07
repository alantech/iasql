# 003 - Postmortem for v0.0.26 release

## Level: Internal and Outage

## Author(s)

- David Ellis <david@iasql.com>

## Summary

In some ways this is a continuation of the prior outage. The incident on 2023-01-08 repeated itself in staging and then occurred in production on 2023-02-01, then again on 2023-02-06. By the time the last incident occurred we had a long-term fix prepared and this particular issue should not occur again.

## Timeline

- **2023-01-08**: To recap from the prior postmortem, because it is relevant here: The staging instance becomes unreachable. Somehow the DHCP daemon failed to get an IP address assigned by AWS. Manually stopping and starting the server revived it.
- **2023-01-30**: The staging instance goes down again with the same error. Instead of it being a one-off weird issue, something about the staging EC2 repeats this issue, investigation begins again.
- **2023-02-01**: The production instance goes down with the same issue. Investigation goes from trying to figure out what's weird with the staging EC2 in particular to what is wrong with our code.
- **2023-02-02**: We determine that there's a memory leak, despite supposedly capping our Node process to 8GB of RAM.
- **2023-02-03**: The exact source of the memory leak has not yet been identified, but a temporary patch that alleviates it is created as a "Plan B" to unblock release.
- **2023-02-04**: The root cause is finally determined to be a strange design decision within TypeORM's `ConnectionManager` object where `Connection` objects are *never* deleted, so the codebase is modified to never use it, fixing the memory leak.
- **2023-02-06**: Before the fix could be deployed to production, the production instance went down again, but was quickly brought back up.

## Detection

The issue was originally detected in January in staging, but manifested in a strange way by causing the DHCP daemon to fail to renew an IP address and making the server completely inaccessible. It didn't show up in production for almost a whole month, so it was considered to be something strange with the staging EC2 at first and deprioritized.

When it showed up in staging a second time, an investigation was started, but did not complete soon enough to prevent the production outages that eventually occurred.

## Response

There were two main actions that were taken that eventually lead to figuring out what was going on:

1. We increased the CloudWatch monitoring on staging beyond the default metrics, installing a cloudwatch agent onto the EC2 instance and tracking more system metrics. There we spotted that memory usage was growing linearly and increasing well past the 8GB limit we thought we had imposed on the machine.
2. We set up the Chrome Debugger to interface with the IaSQL dev docker container and took VM memory snapshots while executing `iasql_install` and `iasql_uninstall` operations, noting the growth over time (~10MB between each operation taken) and comparing the object sets, noting which ones weren't being deleted. There were a few false flags in there, including a not-helpful-for-us behavior Chrome attaches to `console.log/error/etc` to hold onto objects passed to it forever, making our `console.error` reporting accidentally point at the wrong part of the codebase. Eventually an internal data structure within the TypeORM `ConnectionManager` was determined to be the root cause.

## Cause

Our usage of TypeORM is very atypical of most codebases. We implemented a DAG-based module system on top of the linear migration system of TypeORM to allow users to only have tables for AWS services they actually use. We have Postgres functions that call into the engine that then use TypeORM to call back into the database. And most important here: we have a dynamic set of Postgres databases we set up and tear down as a normal part of using IaSQL, so we can't ever be sure if a TypeORM `Connection` to a database can be kept around or not, so we simply construct `Connection` objects on each RPC request and then throw them away afterwards. Or so we thought.

TypeORM provides a `createConnection` helper function to easily give you a fully set up `Connection` object to work with, called by `await createConnection(connectionName, connectionConfig)`. If that `connectionName` has already been used, it will throw an error at you, and you should instead `connectionManager.get(connectionName)`, which encourages reuse. Though that `Connection` object may also actually be disconnected, so you should still do an `if (!connection.isConnected()) ...` check and re-connect it in that case. This whole API feels riddled with footguns, but there may be some reason for it for more typical users.

Reworking our code to use more deterministic names *seems* like the proper solution here, but actually wouldn't work, because a TypeORM `Connection` object also includes all of the TypeORM `Entities` to be used in querying the database. For most users of TypeORM that's fine, but for us, the set of `Entities` changes based on which modules the user has installed, and the user can change that set of modules on the fly through `iasql_install` and `iasql_uninstall` calls. Periodically cleaning the `ConnectionManager` could have worked, if TypeORM provided a `delete` mechanism, but they didn't; anything added to the `ConnectionManager` is there forever, so the only thing we could do was manage the `Connection` objects' lifetimes manually ourselves, and is what we did.

## Prevention

The major piece of future prevention was added already: the increased monitoring on staging (and now production, as well) so we are aware of baseline parameters of the servers properly monitored. It is surprising that something as basic as RAM usage is not part of the default CloudWatch metrics.

It is also surprising that Node no longer has the 4GB default memory limit and that our 8GB max size was apparently a recommendation rather than a true limit. Modern dev tooling is complex and changing frequently, so monitoring is the true guardian of DevOps, not documentation/prior experience, as it may be out of date, and not even configuration, as it may be ignored.

Unexplained outages, even if they are on the more chaotic staging environment, should be given a higher priority on figuring out the actual root cause. If the monitoring work had been started on staging shortly after the 2023-01-08 staging outage, the true root cause likely would have been discovered before the 2023-02-01 production outage.