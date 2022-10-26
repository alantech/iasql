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

### Current Situation

The current IaSQL is following the first of four envisioned "modes" of operation:

1. "Manual" or "IaC-style" mode: changes are made to the database by the user, which can then be checked via the `iasql_preview_apply()` function and executed with `iasql_apply()`, and then changes that were done in the cloud can be checked against the database with `iasql_preview_sync()` and pulled into the database with `iasql_sync()`.
2. "Read-only Automatic" or "Cloudquery-style" mode: the IaSQL engine basically puts `iasql_sync()` on a cron job and disables `iasql_apply()`. This is for those who just want to query their cloud accounts but not manage them through IaSQL.
3. "Write-only Automatic" or "Anti-Chaos-Monkey" mode: the inverse of the prior one, `iasql_sync()` is (mostly) eliminated (excepting during `iasql_install()` calls) and `iasql_apply()` is put on a cron job. This is like IaC-style usage, except IaSQL is effectively constantly monitoring the cloud for regressions in its state versus the database and constantly pushes it back to the desired state. This is similar to uDeploy or Kubernetes' desired state eventual consistency, but applied to the entire cloud.
4. "Read/Write Automatic" or "Two-Way" mode: originally not thought possible, but is doable via change tracking with an audit log: check the differences between the cloud state and database state, then look up via the audit log if the noted change was explicitly triggered by the user, or is from the cloud, and then decide what operation to perform, syncing changes from the cloud (which could be due to users still managing part of their infrastructure with IaC tools) and applying changes to the cloud where that was the user's intention.

Each of these different "modes" have their own use-cases with various pros and cons, and they all seemed to be incompatible with each other. If the database is in one of the three automatic modes, there's no way to preview the changes that are going to happen. If the database is in read/write automatic mode, it won't restore critical infrastructure actually managed by IaSQL like the write-only automatic mode would, but write-only automatic mode prevents *any* other IaC tool from being used, so adoption would have to be all-or-nothing if that automatic restoration property was what brought someone to IaSQL in the first place.

Recent work on the AWS `codebuild`, `codedeploy`, and `codepipeline` services has demonstrated that only "Two-Way" mode is actually viable: `codebuild`, for instance, accepts an arbitrary, user-defined YAML file describing the process to build code from some place and store it in some other place. IaSQL cannot know before it triggers `codebuild` what it will do, and so during the `iasql_apply` call suddenly there will exist resources, such as a new ECR image, that are not in the database which `iasql_apply` will want to remove because that's not part of the "desired" state as far as the engine is concerned, but *is* the true desired outcome from the user.

Attempting to `iasql_sync` in the middle of that `iasql_apply` could cause IaSQL to drop other operations it is supposed to be performing, freezing their cloud into some unexpected intermediate state. And it is impossible to "parse" the YAML to determine what resources are going to be created. Since the YAML allows arbitrary shell script execution, the script could do something like `if (Math.random() > 0.5) { writeToS3(); } else { writeToECR(); }` or even `curl https://raw.githubusercontent.com/company/project/some_binary_that_calls_aws_apis; chmod +x some_binary_that_calls_aws_apis; ./some_binary_that_calls_aws_apis;` and there's no good, general purpose way to know what the side-effects of `codebuild` will be.

However, it is possible for "Two-Way" mode to emulate the other three in a way that is also mostly-backwards-compatible with the current manual mode. Furthermore, a singular IaSQL database would be able to have different "parts" of the database emulating different modes at the same time.

### Immediate Proposal

To accomplish this, let's assume under normal operations, there is a singular apply/sync-combined command to perform the "Two-Way"-style action. It works similarly to the current sync and apply, but also uses the audit log to decide for each record which behavior to follow. This piece can be operated in a "manual" style, invoked explicitly, but we'll instead invoke it through a cron-like interval, every few minutes, to make the automatic mode. In this way, there is no special syntax for users to work with normally. They just `SELECT/INSERT/UPDATE/DELETE` records they see and eventually this is reflected in their cloud account. This should also work with migration systems without issues, though in an eventually-consistent fashion.

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

There are two ways the background processing could be implemented: we could have the engine trigger work on a periodic basis in code, or we could use `pg_cron` to have the database create graphile worker jobs. There are pros and cons to both approaches, but the likely outcome in various failure modes provides the strongest support behind the `pg_cron` approach:

| Failure Mode | Cron | Event |
| ------------ | ---- | ----- |
| Stuck job >45min | The graphile worker library kills the job after 45 minutes and then the cron starts work again, which  may resolve correctly this time or it may be stuck again, but any new changes by the user to the DB will be considered. | The graphile worker library kills the job after 45 minutes and then no event for the next run is triggered, which causes this DB to be soft-locked until there is an engine redeploy. |
| Engine dies | The cron keeps trying and failing to call the engine. The cron SQL function inserts start and end audit records immediately after each other, and does nothing. | Nothing happens at all. |
| Database dies | Nothing happens at all. | The inner cron of the engine will keep trying to communicate to the DB and fail. This may or may not be handled correctly by our code. |
| Engine deployed | The cron creates the graphile job and one of the two parallel versions of the engine takes the work (as this approach requires a SQL RPC call to start the engine) and the other doesn't work on it. If it is the old version that takes it, it may fail and no work will happen for 45 minutes, then it will continue. | The two engines both have their own inner cron unaware of each other and very likely they will both try to execute at the same time for 7-10 minutes. What they will do is undefined unless we thoroughly test it, but likely they will "fight" with each other undoing each other's work and potentially corrupting the DB. |

Most of the failure modes when using the cron approach lead to delays in eventual consistency between the database and the cloud, while the event-based approach can lead to more catastrophic failures.

Backing the cron approach would be a minor addition to the existing audit log to go with the graphile worker job creation. If we have the new cron logic and the rollback/commit calls add rows to the audit log when it starts and ends, they can check if the most recent of these records is a `start` one, implying that the engine is currently working on applying and synchronizing changes with the cloud, and would alter their behavior slightly. The `cron` would simply early exit in this case, as it implies there is an existing cron that has gone overtime, and so it should wait until the next execution of the cron to try again. `iasql_begin` would block until a paired `end` record exists and then continue with its work. `iasql_rollback` and `iasql_commit` should therefore never see this state after `iasql_begin` is called, but for defensiveness they should as well block until an `end` record exists and then do their own work.

These checks should also pay attention to the timestamp and ignore the missing `end` record condition if it has been "too long" and therefore the engine was likely restarted in the meantime. The exact time will depend on what limit we ourselves put on the new commit logic, but perhaps 45 minutes (the current apply/sync timeout time).

It is recommended to keep `iasql_apply`, `iasql_sync`, `iasql_preview_apply`, and `iasql_preview_sync` as functions that can be called, but make them no-ops that warn/error that they don't do anything anymore, and that at some time in the future these functions will be dropped. The reasoning behind this is that this transition will take some time and there may be IaSQL snippets out there that do continue working after this transition assuming they didn't call either of those functions. We can track the number of actual invocations in these functions by having the engine-side implementation simply fire off an alert to us. If we see little-to-no triggering by end users, we could drop them sooner rather than later.

### Future Work

The two-way mode plus transaction-like logic resolves the issue with the `code-` modules (or anything that triggers side-effect mutations in the cloud) while also still allowing the more diligent to review the implications of their changes. But we can do better.

First, while entering the transaction mode introduces a synchronous point (such that `CALL iasql_commit();` blocks until the apply/sync operation is complete), there may be times where a user made changes in non-transactional two-way mode but they now need to wait for resources to actually be created. A proposed helper function would trigger a blocking call until a user condition is met. One possible syntax for this is:

```sql
SELECT iasql_wait_for('table_name', 5, 'cloud_id IS NOT NULL'); -- Default version

SELECT iasql_wait_for('table_name', 5, 'cloud_id IS NOT NULL', 30); -- Optional argument for maximum # of seconds to wait before erroring (defaulting to 5 minutes or something)

SELECT iasql_wait_for_all(); -- This uses special querying of the audit log to make sure all changes up to the time this function is invoked are represented in the cloud
```

The `iasql_wait_for` functions essentially execute (on another postgres thread/process) a particular select statement in a loop with a sleep thrown in until success or it errors out if the condition is never met. That select statement generated would be something like:

```sql
SELECT count(*) > 0 FROM `table_name` WHERE id = `5` AND `cloud_id IS NOT NULL`
```

The `iasql_wait_for_all`

The parts in backticks are from the user-provided values. This is SQL injection, but it's their own database and we already allow arbitrary SQL statements to run on the database, so it doesn't affect the security situation in the slightest, even if it does immediately cause heart palpitations while looking at it. ;) This is also not blocking for the transition, but simply a pair of convenience functions that we should be able to provide relatively easily.

We can continue from here to emulate the two One-Way automatic modes, taking a page from Postgres' [Table and Row-Level Locking](https://www.postgresql.org/docs/15/explicit-locking.html).

Naming these modes to be clearly understood will be important so "Anti-Chaos-Monkey" can't be what we go with here. ;) The current proposal for the name for the "Write-Only Automatic" style functions is "Enforce" as the user is asking IaSQL to enforce the entire database or particular rows and/or tables to always match the database, and the "Read-Only Automatic" style becomes "Track" as the user is asking IaSQL to track the upstream cloud. These various configuration choices have differing levels of scope and collisions between the rules can be confusing. How these are interpreted needs to be well-defined and queryable. So we need a new table to represent these states in the database, and then we should follow a few rules:

1. More specific rules override less specific rules, so if we "track" cloud changes for a table, but "enforce" one particular row from that table, the "enforced" row will be "write-only automatic" while the rest of the records in the table will be "read-only automatic".
2. Equal level contradictory rules should not exist, but if they can, we should err on the side of not breaking things, so "Read-Only Automatic" > "Two-Way Automatic" > "Write-Only Automatic" when dealing with a tie.

That last one *shouldn't* be a problem for us, though, because we can define a new `iasql_mode` table like this:

| iasql_mode |   |
| ---------- | - |
| table_name | NULLABLE VARCHAR |
| record_id  | NULLABLE INT |
| mode       | ENUM(NORMAL, ENFORCE, TRACK) |
| | |
| UNIQUE | (table_name, record_id) |
| FK | (table_name => iasql_tables.table) |

The unique constraint makes it impossible to set two different modes of behavior on the same rule level, the nullable `table_name` and `record_id` allows providing `NULL` for the wildcard case, and the foreign key on the `iasql_tables` table makes sure specified tables actually exist. I can't find a good way to also enforce that the `record_id` also exists, though. If there is no `iasql_mode` record that would apply to a given record being considered, the `NORMAL` mode would be assumed to apply (so this table being empty is not a configuration error). The `NORMAL` enum state is defined to allow overriding particular tables or records back to the default state if a more global state is not the default mode.

If one wants to emulate the read-only SQL cloud tools like CloudQuery and Steampipe, you'd need to only insert a single statement:

```sql
INSERT INTO iasql_mode (mode) VALUES ('TRACK');
```

which makes the `table_name` and `record_id` columns `NULL` and therefore act as wildcards. This mode would work much like `iasql_sync` does today, but at all times.

If a company wants to only use IaSQL and quasi-disable any other approaches, they could call:

```sql
INSERT INTO iasql_mode (mode) VALUES ('ENFORCE');
```

and any differences between the cloud and database would be seen as deficiencies and eliminated. This would work like `iasql_apply` at all times.

However, in this latter version, it is likely that some cloud resources would need to be exempted. For instance S3 `bucket`s may be managed by IaSQL, but the `bucket_object`s within them may be user-generated data, in which case an IaSQL user would instead configure it something like:

```sql
INSERT INTO iasql_mode (mode, table_name) VALUES ('ENFORCE', NULL), ('TRACK', 'bucket_object');
```

And the `record_id` exceptions could be used to allow that one team still using Terraform to continue deploying that way while the rest of the infrastructure is enforced, or something like that. These extra configuration levels are definitely power-user tooling and not really necessary until there is a power user that desires it.

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

### Required Implementation

1. Implement the `iasql_commit` function and port test suite to using it. (1 week)
2. Implement pausable cron and transaction functionality, make `apply/sync` no-ops, and update the test suite again. (1 week)

### Optional Follow-up Work

3. Implement WaitFor and add new tests for them (1-2 days)
4. Implement Track and add new tests for them (3-4 days)
5. Implement Enforce and add new tests for them (3-4 days)

