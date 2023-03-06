# 004 - Postmortem for v0.1.3-beta TypeORM upgrade to v0.3.x

## Level: Internal

## Author(s)

- Alejandro Guillen <alejandro@iasql.com>
- David Ellis <david@iasql.com>

## Summary

During the typeorm upgrade, @dfellis found a bug in the function recreating the entities. It was passing to the `findOne` the wrong attributes. Why tests in `main` were working? Because the `apply` algorithm does an `apply` with filters, but if that goes wrong (as it was happening) it catches the error, shows a warning and continues with a full `apply` (no filters, so no bug recreating entities).

Fixing this bug recreating the entities has surfaced at least 2 new cases that we were not handling correctly as we could see in the tests failing (ec2 and ecs).

### Cases found

#### EC2 integration tests

Here the issue was with the `RegisteredInstance` entity, its function is to link instances with target groups. The `entityId` it's a combination of all its fields. One of the fields is the `instanceId` coming from the `Instance` entity. The problem was that the instance was getting replaced (delete + create) and that should trigger an update for the `RegisteredInstance` entity since one of the values of the `entityId` has changed. The problem is that this latest change is not seen because we are filtering in the `apply` loop by the entities that have changed based on the audit log. Then the `sync` just removes the record from the DB.

#### ECS integration tests

The problem in ecs. We were calling from the `TaskDefinition`'s `cloud.update` function the `db.create` function to force the creation of a new task definition. Again, the filter in the `apply` loop is not seeing this change because it was not done by the user and it was done after the commit started.


## Timeline

- **2023-02-21**: @dfellis started working on the typeorm update
- **2023-02-21**: Tests on ec2 and ecs were the only ones failing
- **2023-02-27**: @dfellis found a bug recreating the entities and fix it using the right Typeorm property names and structures
- **2023-03-01**: @dfellis and @aguillenv detected the problem on ec2 tests and commented possible solutions
- **2023-03-01**: @dfellis fixed ec2 tests with a solution that breaks encapsulation
- **2023-03-03**: @aguillenv fixed ecs tests
- **2023-03-03**: typeorm version update got merged

## Detection

The problem has been around since we landed the 2-way mode. It was working because we were doing a full apply when something goes wrong (as it was) and we were only reporting a warning but not throwing.

Both issues got detected during the typeorm upgrade, the tests failed and going through the engine logs to identify the unexpected behaviours.

## Response

Both test suites are passing now because we were able to add the right logic in each mapper to handle this, but it's breaking module encapsulation which we want to keep at a minimum or inexistent.

## Cause

For the 2-way mode we needed to check the audit logs and recreate the entities to then use them in a filter and only apply relevant changes per commit operation. To do that entity recreation, we needed to go trough the Typeorm internals and by mistake we were passing the wrong properties when recreating relationships.

## Prevention

The issue was covered by typeorm not hard failing before and our try/catch on the apply to run a full one if something failed, which made this pass for a long time silently.
We might need to so some tweaks to the current `commit` algorithm to handle these 2 cases we found during this upgrade.

### High-level steps of the current `commit` algorithm

1. Get relevant audit logs
2. Get relevant modules based on step 1
3. If any change:
    1. Execute partial `apply` (passing only the relevant changes and modules)
    2. If error on partial `apply`, execute full `apply`
4. Execute full `sync`
5. If full `apply` or `sync` error, execute `revert`
6. Return the `sync` response

### High-level steps of the current `apply` algorithm

Outer loop:
1. Execute `db.read`s
2. Recreate changes after the commit started

    Inner loop:
    1. Execute `cloud.read`s
    2. If necessary, recreate relevant changes
    3. Execute `diff`ing logic
    4. If relevant changes, filter them
    5. If no relevant changes, exclude changes done after `commit` started
    6. Mappers execution

### High-level steps of the current `sync` algorithm

Outer loop:
1. Execute `cloud.read`s

    Inner loop:
    1. Execute `db.read`s
    2. Recreate changes after the commit started
    3. Execute `diff`ing logic
    5. Exclude changes done after `commit` started
    6. Mappers execution


### Possible alternatives

It's tricky to find a common solution for both cases found. For the ECS case might be simpler, we need to find a way to also see the changes done by the engine during the `commit`. In the EC2 case, we need either to ignore the relevant changes and `apply` for all modules or find a way to "mark" entities that might be affected by another entity change and somehow include them in the filter.

#### Executing "full" `apply`
This is one possible solution that could solve both issues. Would be similar to the current algorithm but we do not get "relevant changes". We always `apply` for all modules and only exclude changes done **by the user** after `commit`.

##### Pros 
- Solves the 2 issues
- Easier to implement?

##### Cons
- We lose the "faster" `apply` since we need to iterate through all modules installed and not only the ones with changes.
- If there is a change in the cloud that hasn't yet been synced, the full apply will blow it away and then the follow-up sync step will do nothing (in fact, there is no point in doing the sync at all, anymore, because the DB becomes the sole source-of-truth and we only sync during install).
