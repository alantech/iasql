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

The problem has been around since we landed the 2-way mode. It was working because we were doing a full `apply` when something goes wrong (as it was) and we were only reporting a warning but not `throw`ing an error.

Both issues got detected during the typeorm upgrade, the tests failed and going through the engine logs to identify the unexpected behaviours.

## Response

Both test suites are passing now because we were able to add the right logic in each mapper to handle this, but it's breaking module encapsulation which we want to keep at a minimum or inexistent.

## Cause

For the 2-way mode we needed to check the audit logs and recreate the entities to then use them in a filter and only apply relevant changes per commit operation. To do that entity recreation, we needed to go trough the Typeorm internals and by mistake we were passing the wrong properties when recreating relationships.

## Prevention

To summarize the issues above, the ECS error was the `cloud.update` path making a DB change that was misinterpreted because of the user involved and then the `sync` step reverted it, while the EC2 error was no explicit change in the database itself, but the conceptual change of the entity because the instance it is pointing at changed.

The first one is an explicitly pushed change by the function, and the fix was to actually create the new TaskDefinition in the cloud and then let the sync step pull that in. The fix done for the first issue is correct and there is nothing special that needs to be done there. If we tried to change the user of db creation we would actually be creating a false history in the audit log. This way is actually clear in what is going on:

- The user wants to edit a `TaskDefinition` and does so.
- The mapper knows that the set of `TaskDefinition`s is an append-only structure within AWS so it restores the original DB record and creates a new `TaskDefinition` based on the user's change.
- The `sync` stage sees this new `TaskDefinition` that wasn't explicitly created by the user, and pulls it into the database.

The issue with `RegisteredInstance` is much tougher. It should not be the responsibility of `Instance` to know that there's a "parasitic" entity like this attached to it and manually calling it's update logic, so the current solution is a hack, but there was also no DB change to indicate it should be looked at. Going through the list of changes since the last commit in the audit log will not show this `RegisteredInstance` record so there's nothing to "keep" in the filter.

What we need is some sort of reverse lookup mechanism. Currently there is a one entity -> one mapper relationship, and the entity in question is passed directly to the mapper logic. We need something that will:

- Look up `N` mappers for an entity, where mappers can register an "interest" in more than one entity.
- Take the input entity and determine the mapper's relevant entity. Such as looking for the `RegisteredInstance` record(s) given an `Instance` record.

99% of the time, these will both be identity functions; there's only one mapper relevant for a given entity, and the relevant entity for that mapper is the entity itself, so it should also have an automatic default that we override only when needed.

This could look something like:

```ts
watchEntities: {
  RegisteredInstance: (e: RegisteredInstance): RegisteredInstance => e,
  Instance: async (e: Instance, ctx: Context): Promise<RegisteredInstance[]> => {
    return await ctx.orm.find(RegisteredInstance, {
      where: {
        instanceId: e.id,
      },
    });
  },
  ...
}
```

Then we have some internal data structure to group these by entity on the first level, the mapper on the second level, with `SomeObj[entityName].map(mapper => mapper.relevantEntities[entityName](entity))` returning an array of promises (or not but should be fine with a Promise.all) providing the actual set of entities to consider changed (To make this a set it would also need them all to be checked with entityId for uniqueness to eliminate any duplicates that might arise.).

  :::note

      The proposed solution will be created as a task and its implementation will be delayed until we encounter with an use case similar to `RegisteredInstance`.

  :::
