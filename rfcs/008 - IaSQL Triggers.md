# 008 - IaSQL Triggers

## Current Status

### Proposed

2023-01-09

### Accepted

YYYY-MM-DD

#### Approvers

- Full Name <email@example.com>

### Implementation

- [ ] Implemented: [One or more PRs](https://github.com/iasql/iasql-engine/some-pr-link-here) YYYY-MM-DD
- [ ] Revoked/Superceded by: [RFC ###](./000 - RFC Template.md) YYYY-MM-DD

## Author(s)

- Mohammad Teimori Pabandi <m@iasql.com>

## Summary

An IaSQL Trigger is a pair of a "check" and a "statement". Every time a change is made on the database or on the cloud,
the "check" will be evaluated and if it returns `true`, then the "statement" will be executed. This can be a cool
feature for IaSQL, and be an advantage compared to other tools like Terraform.

## Proposal

Now that we have our two-way mode in place, and we have added `pg_cron` to our database which is being called once in a
while, why not add IaSQL Triggers which will give our users the ability to react to the changes from/to the cloud? This
will open opportunity for a lot of flexibility and awesome possibilities.

I'll start with the easiest-to-implement version of IaSQL Triggers and continue to propose other possibilities that can
be added in the future.

### IaSQL Triggers v1: Simple Check-Statement Design

Just a simple "check" and "statement" pair.

Let's try this check:

```postgresql
SELECT CASE
           WHEN state = 'stopped' THEN TRUE
           ELSE
               FALSE
           END AS check_result
FROM instance
WHERE id = 1
```

And the statement can be any valid SQL to be executed. Let's say call an RPC function that will email a certain address
to notify that the instance has been stopped.

| Check                                                                                                                                                        | Statement                                                          |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------|
| SELECT CASE             WHEN state = 'stopped' THEN TRUE             ELSE                 FALSE             END AS check_result  FROM instance  WHERE id = 1 | SELECT send_mail('m@iasql.com', 'the instance has been stopped!'); |

While having this Trigger in place, any time the instance has been stopped I'll receive an email indicating that the
instance has been stopped. Also, I can create a custom Postgres function for both the "check" and the "statement" and
simply call them here (instead of inserting the whole code in the row).

The "check" doesn't have to work only with the data from our own database, we might want to check if cpu for an instance
is more than 90%, then restart that instance. For this case we can use an RPC to get the CPU usage of the instance
first (a good idea related to the "Explore lower level module creation and UX" task), and if it was more than 90%, then
we can call another RPC that also calls AWS APIs to restart the instance.

This opens a great room for other opportunities and areas IaSQL can grow. For example let's say I want to monitor all
key pairs on my account and if a new one is created, get notified (because it might not be me or a colleague, but a
sneaky attacker trying to manipulate my infrastructure, right?). This feature is currently unavailable to a tool like
Terraform because it just follows the objects that you have explicitly added or imported to your codebase (the objects
that are being followed are saved into the `state.json` file).

To check if the above idea (or a similar one) is currently easy-to-implement, I did a bit of research and found these
links:

- https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/monitor-ec2-instance-key-pairs-using-aws-config.html
- https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/send-a-notification-when-an-iam-user-is-created.html
- https://lantern.splunk.com/Security/Use_Cases/Threat_Hunting/Monitoring_AWS_EC2_for_unusual_modifications

BTW that idea of monitoring the key pairs and if a "new" object was inserted then notifying is not available in the
IaSQL Triggers v1, because we'll need to integrate `iasql_audit_log` into the play to also be able to act on the "
changes".

### IaSQL Triggers v2: Bring The Transition Into The Play

There are states in which we also need to know what is changing to what and our "check"s aren't just stateless boolean
functions. In those cases we'll also need to know the previous state and the next state. Thanks to
the `iasql_audit_log` table, we'll be able to go for this version of IaSQL Triggers which will open even more
opportunities:

- If a new key pair was added to the system, notify the security guy
- The above idea but in more general form: if there was a change to a certain group of resources outside IaSQL, notify
  the security.
- Don't allow anyone to make a specific change in the database ("statement" = `BLOCK`): this can lead to an internal
  permission-management system for IaSQL as well. And maybe if the change was happened on the cloud, notify the
  security (IaSQL Constraints).
- If a new object was created in `my-bucket` S3 bucket, then do something (currently Lambda could be triggered by S3
  object creation, but I think IaSQL Triggers is a superset of Lambda triggers)

Which gives us a hint for a possible good area of improvement for IFTTT-style stuff on the cloud.

This is possible by editing `iasql_audit_log` to also contain `resource_id` and `resource_type` to follow the
object lifecycle. And will also open these areas:

- Partial Migrations: Let's say someone wants to generate a migration for a specific resource in the cloud (not
  everything he has in his account). In this case having a column that shows the exact steps that were taken for that
  resource would be useful.
    - Can also include "related" objects.

## Alternatives Considered

In the version 2: we can call the IaSQL Triggers through the engine itself which removes the need for changing the audit
log table.

## Expected Semver Impact

This would be a minor update adding a new functionality and should not break the behavior of the existing code.

## Affected Components

- IaSQL audit log
- `pg_cron`
- New IaSQL Triggers table

## Expected Timeline

The initial version can be implemented in a day or two. But version 2 needs more investigation and since it still
doesn't have a clear implementation, it needs more discussion.