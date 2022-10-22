# 004 - Continuous Two-Way Synchronization RFC

## Current Status

### Proposed

2022-10-22

### Accepted

YYYY-MM-DD

#### Approvers

- Luis Fernando De Pombo <luis@iasql.com>
- Alejandro Guillen <alejandro@iasql.com>
- Yolanda Robla <yolanda@iasql.com>

### Implementation

- [ ] Implemented: [One or more PRs](https://github.com/iasql/iasql-engine/some-pr-link-here) YYYY-MM-DD
- [ ] Revoked/Superceded by: [RFC ###](./000 - RFC Template.md) YYYY-MM-DD

## Author(s)

- David Ellis <david@iasql.com>

## Summary

Switching the behavior and interaction model for IaSQL to one that is continuously synchronized with their cloud account resolves issues with certain AWS services and opens up many new interaction models. Part of this proposal is to lay out the added value of this approach, and how it is still possible to replicate the current IaC-like staging updates and checking/confirming they are what is desired before being applied to the cloud, and the other part of this proposal is to convince you that it is *better* to be slightly backwards incompatible instead of maintaining a full backwards compatibility with the current structure.

## Proposal

The current IaSQL is following the first of four envisioned "modes" of operation:

1. "Manual" or "IaC-style" mode: changes are made to the database by the user, which can then be checked via the `iasql_preview_apply()` function and executed with `iasql_apply()`, and then changes that were done in the cloud can be checked against the database with `iasql_preview_sync()` and pulled into the database with `iasql_sync()`.
2. "Read-only Automatic" or "Cloudquery-style" mode: the IaSQL engine basically puts `iasql_sync()` on a cron job and disables `iasql_apply()`. This is for those who just want to query their cloud accounts but not manage them through IaSQL.
3. "Write-only Automatic" or "Anti-Chaos-Monkey" mode: the inverse of the prior one, `iasql_sync()` is (mostly) eliminated (excepting during `iasql_install()` calls) and `iasql_apply()` is put on a cron job. This is like IaC-style usage, except IaSQL is effectively constantly monitoring the cloud for regressions in its state versus the database and constantly pushes it back to the desired state. This is similar to uDeploy or Kubernetes' desired state eventual consistency, but applied to the entire cloud.
4. "Read/Write Automatic" or "Two-Way" mode: originally not thought possible, but is doable via change tracking with an audit log: check the differences between the cloud state and database state, then look up via the audit log if the noted change was explicitly triggered by the user, or is from the cloud, and then decide what operation to perform, syncing changes from the cloud (which could be due to users still managing part of their infrastructure with IaC tools) and applying changes to the cloud where that was the user's intention.

Each of these different "modes" have their own use-cases with various pros and cons, and they all seemed to be incompatible with each other. If the database is in one of the three automatic modes, there's no way to preview the changes that are going to happen. If the database is in read/write automatic mode, it won't restore critical infrastructure actually managed by IaSQL like the write-only automatic mode would, but write-only automatic mode prevents *any* other IaC tool from being used, so adoption would have to be all-or-nothing if that automatic restoration property was what brought someone to IaSQL in the first place.

Recent work on the AWS `codebuild`, `codedeploy`, and `codepipeline` services has demonstrated that only "Two-Way" mode is actually viable: `codebuild`, for instance, accepts an arbitrary, user-defined YAML file describing the process to build code from some place and store it in some other place. IaSQL cannot know before it triggers `codebuild` what it will do, and so during the `iasql_apply` call suddenly there will exist resources, such as a new ECR image, that are not in the database which `iasql_apply` will want to remove because that's not part of the "desired" state as far as the engine is concerned, but *is* the true desired outcome from the user.

Attempting to `iasql_sync` in the middle of that `iasql_apply` could cause IaSQL to drop other operations it is supposed to be performing, freezing their cloud into some unexpected intermediate state. And it is impossible to "parse" the YAML to determine what resources are going to be created. Since the YAML allows arbitrary shell script execution, the script could do something like `if (Math.random() > 0.5) { writeToS3(); } else { writeToECR(); }` or even `curl https://raw.githubusercontent.com/company/project/some_binary_that_calls_aws_apis; chmod +x some_binary_that_calls_aws_apis; ./some_binary_that_calls_aws_apis;` and there's no good, general purpose way to know what the side-effects of `codebuild` will be.

However, it is possible for "Two-Way" mode to emulate the other three in a way that is also mostly-backwards-compatible with the current manual mode. Furthermore, a singular IaSQL database would be able to have different "parts" of the database emulating different modes at the same time.

To accomplish this, let's assume under normal operations, there is a singular apply/sync-combined command to perform the "Two-Way"-style action. It works similarly to the current sync and apply, but also uses the audit log to decide for each record which behavior to follow. This piece can be operated in a "manual" style, invoked explicitly, but we'll instead invoke it through a cron-like interval, every few minutes, to make the automatic mode. In this way, there is no special syntax for users to work with normally. They just `SELECT/INSERT/UPDATE/DELETE` records they see and eventually this is reflected in their cloud account.

To emulate manual mode would basically be to temporarily turn off that cron, let the user make whatever changes they want to batch together, and then re-enable that cron. Because we can't actually support the current `iasql_apply` for the three `code-` services, and because entering this batching mode that could potentially be unwound, it looks a *lot* like a transaction, so the proposed new syntax would be to emulate that:

```sql
CALL iasql_begin(); -- Disables the cron. Wrap a function call inside of a procedure so we can avoid the confusing `SELECT iasql_begin();` syntax here.

-- Do some DB changes

SELECT * FROM iasql_preview(); -- Because there's no distinction between apply and sync, this function name is simpler than before

-- If we don't like what we saw

CALL iasql_rollback(); -- Executes `iasql_sync`, then re-enables the cron

-- If we like what we saw

CALL iasql_commit(); -- Re-enables the cron, but also performs a blocking execution of the new logic so a `SELECT` on the newly-created records has the desired cloud IDs
```

To emulate the two One-Way automatic modes, we can take a page from Postgres' [Table and Row-Level Locking](https://www.postgresql.org/docs/15/explicit-locking.html). We can create sets of functions to put a whole table or just specific rows into either of these modes or put them back to normal operations. These functions would write to a new metadata table that would override the decision the audit log makes, which makes them pretty easy additions to the functionality while gaining significant power and flexibility for users (and could be pure SQL stored procedures that don't go through the engine's RPC path at all, since they just manipulate a config table).

Naming these functions to be clearly understood will be important so "Anti-Chaos-Monkey" can't be what we go with here. ;) The current proposal for the name for the "Write-Only Automatic" style functions is "Enforce" as the user is asking IaSQL to enforce these particular rows or tables to always match the database, and the "Read-Only Automatic" style becomes "Track" as the user is asking IaSQL to track the upstream cloud. The proposed new syntax for these is:

```sql
SELECT iasql_enforce('table_name'); -- Enforce an entire table onto the cloud.

SELECT iasql_enforce('table_name', 5); -- Enforce a particular row from a table onto the cloud. We need to use the database ID here because enforcement *will* cause `@cloudId` churn if it needs to recreate the resource.

SELECT iasql_enforce_all(); -- Essentially makes the DB write-only

SELECT iasql_drop_enforce('table_name'); -- Drop the enforcement of the table. Should it also automatically drop specific row-level enforcement is something to decide. I'm leaning towards "yes" but it could be unexpected.

SELECT iasql_drop_enforce('table_name', 5); -- Drop the enforcement of a particular row. This one, at least, is unambiguous.

SELECT iasql_drop_enforce_all(); -- Restores normal behavior.

SELECT iasql_track('table_name'); -- Makes the table effectively read-only.

SELECT iasql_track('table_name', 5); -- Makes a particular row read-only.

SELECT iasql_track_all(); -- Makes the DB read-only

SELECT iasql_drop_track('table_name'); -- Drops tracking for the table. Similar issue to above: should this affect row-level tracking in the same table?

SELECT iasql_drop_track('table_name', 5); -- Drops tracking for a particular row.

SELECT iasql_drop_track_all(); -- Restores normal behavior
```

While entering the transaction mode introduces a synchronous point (such that `CALL iasql_commit();` blocks until the apply/sync operation is complete), there may be times where a user made changes in "normal" two-way mode but they now need to wait for resources to actually be created. A proposed helper function would trigger a blocking call until a user condition is met. One possible syntax for this is:

```sql
SELECT iasql_wait_for('table_name', 5, 'cloud_id IS NOT NULL'); -- Default version
SELECT iasql_wait_for('table_name', 5, 'cloud_id IS NOT NULL', 30); -- Optional argument for maximum # of seconds to wait before erroring (defaulting to 5 minutes or something)
```

Similar to the enforce and track functions, it is essentially executing (on another postgres thread/process) a particular select statement in a loop with a sleep thrown in until success or it errors out if the condition is never met. That select statement would be something like:

```sql
SELECT count(*) > 0 FROM `table_name` WHERE id = `5` AND `cloud_id IS NOT NULL`
```

The parts in backticks are from the user-provided values. This is SQL injection, but it's their own database and we already allow arbitrary SQL statements to run on the database, so it doesn't affect the security situation in the slightest, even if it does immediately cause heart palpitations while looking at it. ;)

The final recommendation is to keep `iasql_apply` and `iasql_sync` as functions that can be called, but make them no-ops that warn that they don't do anything anymore, and that at some time in the future these functions will be dropped. The reasoning behind this is that this transition will take some time and there may be IaSQL snippets out there that do continue working after this transition assuming they didn't call either of those functions. We can track the number of actual invocations in these functions by having the engine-side implementation simply fire off an alert to us. If we see little-to-no triggering by end users, we could drop them sooner rather than later.

So what does all of this buy us?

1. We can support the AWS `code-` services.
2. We get two-way automatic mode by default so most of the examples only need normal-looking SQL statements, making onboarding easier.
3. We get both one-way automatic modes not only for the whole database, but even at table and row granularities, giving us advantages over existing IaC tools (continuously fix failures by restoring infrastructure for you, but also make sure you don't delete resources not owned by your team by blocking mutation of them).
4. The database, in an eventually-consistent way, always reflects the state of your cloud, so querying is straightforward.
5. Two-way mode auto-importing resources created by "other" things should make auto-generating limited modules possible (create an entity from a `List-` AWS API call, then turn every other AWS API into an RPC call from the database, allowing imperative Create/Update/Delete and a read-only table to SELECT results from that is re-synced with the cloud every so often), which will let us more rapidly hit 100% cloud coverage (though with a second-tier of quality), which can help us with larger startups and enterprises that need full coverage more than they need cleaner, mutable tables with explicit dependency foreign keys.

That last piece is particularly interesting because it's a way to help us accelerate our development velocity and potentially turn our current "low-level modules" into "mid-level modules" that could be pure SQL modules depending on these RPC functions, and the "high-level modules" could decide to depend on either of them, depending on what is easier.

### Alternatives Considered

#### Just don't implement any `code-` modules

Basically, we can ~~stick our heads in the sand~~ decide to enforce management of all cloud resources in a way that these changes are represented in our database, but this makes our ability to co-exist with other IaC tools impossible, as well as integrating with any sort of CI system (without basically re-implementing our own CI system we then demand users use). And therefore this approach has been rejected.

#### Implement `iasql_commit` as replacement for `iasql_apply`/`iasql_sync` only

Stick to manual mode and just replace `apply` and `sync` with `iasql_commit`. This allows us to implement the `code-` modules and requires less work, but keeps the harder to explain syntax in the forefront, rather than being a power user tool. It also precludes our ability to support Enforce/Track behavior described above, which narrows our set of advantages.

This may still be a point along-the-way in the conversion to the Full Two-Way Mode, though, but has been rejected as the stopping point.

#### Implement Two-Way Mode with the transaction-like syntax only

Basically just the first half of the proposal, stopping before the Enforce/Track section. This is probably also a point along-the-way, but has been rejected as the stopping point because the remaining features are simpler to implement and provide significant functionality.

## Expected Semver Impact

If we were post v1.0.0, this would be a major update.

## Affected Components

- The `iasql_functions` module
- The core RPC scheduler
- The entire test suite
- Most of the documentation

## Expected Timeline

This will take a few weeks to get across the line. The major steps (with estimated times) are:

1. Implement the `iasql_commit` function and port test suite to using it. (1 week)
2. Implement pausable cron and transaction functionality, make `apply/sync` no-ops, and update the test suite again. (1 week)
3. Implement Enforce/Track/WaitFor and add new tests for them (3-4 days)

