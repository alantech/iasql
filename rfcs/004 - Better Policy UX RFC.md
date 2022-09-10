# 004 - Better Policy UX RFC

## Current Status

### Proposed

2022-09-06

### Accepted

YYYY-MM-DD

#### Approvers

- Full Name <email@example.com>

### Implementation

- [ ] Implemented: [One or more PRs](https://github.com/iasql/iasql-engine/some-pr-link-here) YYYY-MM-DD
- [ ] Revoked/Superceded by: [RFC ###](./000 - RFC Template.md) YYYY-MM-DD

## Author(s)

- Joseph <joseph@iasql.com>

## Summary

Customers (even the very technically experienced ones) often have to look up how to construct an AWS IAM policy and then spend time validating the policy before inserting into IaSQL.
This becomes more and more unmanageable as the policy grows.
This is not a good experience, and it can be improved upon. 
We believe we can collect some inputs from IaSQL customers and offer then some form of automation when creating policies, so they can do it faster, more confidently and more conveniently.

## Proposal

* **FUNCTION-RETURNS-JSON approach**: Creating helper postgres functions to help the user generate policies from scratch.
  These functions would return JSON. An example
```sql
    iasql_generate_policy( -- takes in iam_statement_domain[]
         [ -- Statement 1
             "Sid", -- nullable
             "<resource>",
             "principals", -- nullable, array of 2-element arrays of strings varchar[2][] e.g. [["AWS", "12345678899], ["CanonicalUser", "123445567889"],...]
             "<action1>, <action2>", -- comma separated list of actions. varchar
             "<effect>", -- allow/deny. ENUM
             "conditions" -- nullable. varchar[3][] -- array of arrays of 3 string elements e.g [["aws:CurrentTime", "DateGreaterThan", "2021-01-01"], [...]]
         ],
         [...], -- Statement 2
         [...] -- Statement 3
     )
```

To do this effectively, we could have an `iam_statement` `TYPE` and `DOMAIN` with the above fields and some regex validations.

```sql
-- CREATE IAM_STATEMENT TYPE
CREATE TYPE iam_statement AS (sid varchar, effect effect_enum, actions varchar, resource varchar, principal varchar[2][], conditions varchar[3][]);

CREATE DOMAIN iam_statement_domain AS iam_statement 
    CHECK (<...regex checks on properties...>);
```

So the user can use them with entities like this

```sql
-- User creates bucket with the policy
insert into bucket (
        name,
        policy_document
    ) values (
              'some_bucket',
              iasql_generate_policy( -- takes in iam_statement_domain[]
                  [ -- Statement 1
                      "Sid", -- nullable
                      "<resource>",
                      "principals", -- nullable, varchar[2][] -- array of 2-string arrays [["AWS", "12345678899], ["CanonicalUser", "123445567889"],...]
                      "<action1>, <action2>", -- comma separated list of actions. varchar
                      "<effect>", -- allow/deny. ENUM
                      "conditions" -- nullable. varchar[3][] -- array of arrays of 3 string elements e.g [["aws:CurrentTime", "DateGreaterThan", "2021-01-01"], [...]]
                  ],
                  [...], -- Statement 2
                  [...] -- Statement N
                )
            );
```

The `iasql_generate_policy` method will be responsible for performing validations and checks on the inputs as well by
performing regex checks (on resource, principal, actions, effect etc), comparing values against pre-defined ENUMS (for actions, effect),
and [probably] even making calls to the AWS SDK to validate the entire JSON generated before returning it
(ref: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/AccessAnalyzer.html#validatePolicy-property).
With this method, we reduce the probability of user-induced errors and also give them validation results at policy-creation time instead of apply time.

Upside:
* has validations on policy create time
* allows user enter policies in the regular copy-paste JSON way and also through functions


### Alternatives Considered

**TABLES-WITH-FUNCTIONS approach**
We should add new `Policy` and `Statement` entities (perhaps in the `aws_iam` module). These entities would serve as
a way to construct IAM policies in a more user-friendly way. For example, the customer intends to create an S3 bucket with
read-only permissions from all Principals within the same AWS account. Ideally, something like this:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Resource": "aws:arn:123456789012:bucket-resource",
      "Action": [
        "s3:GetObjects"
      ],
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:root"
      }
    }
  ]
}
```

Instead of the customer having to look up and put together a JSON blob like this and then verifying and then inserting, we can also give them
the option to do this using functions that would generate this blob.

```sql
-- User creates policy
iasql_create_policy(
    'some_policy_name',
    '2012-10-17' -- nullable, defaults to 2012-10-17
    );

-- User creates statement and attaches to the policy
iasql_create_policy_statement(
        '<policy_id>',
        'allow',
        'aws:arn:123456789012:bucket-resource',
        's3:GetObjects', -- comma separated list of actions
        '123456789012' -- comma separated list of principals
    );

-- User creates bucket with the policy
insert into bucket (
                name,
                policy_document, -- nullable if policy_id is provided
                policy_id -- nullable if policy_document is provided
            ) values ('some_bucket', NULL, '<policy_id>'); -- triggers a function that would generate the policy JSON, given the policy_id and store in the policy_document field
```

Perhaps these functions could be used together like so

```sql
-- User creates bucket with the policy
insert into bucket (
                name,
                policy_document, -- nullable if policy_id is provided
                policy_id -- nullable if policy_document is provided
            ) values (
                      'some_bucket',
                      NULL,
                      iasql_create_policy( -- returns policy ID after creation
                          'some_policy_name',
                          '2012-10-17', -- nullable, defaults to 2012-10-17
                          iasql_create_policy_statement -- returns policy statement ID after creation
                            'allow',
                            'aws:arn:123456789012:bucket-resource',
                            's3:GetObjects', -- comma separated list of actions
                            '123456789012' -- comma separated list of principals
                            ), -- Statement 1
                          iasql_create_policy_statement(...), -- Statement 2
                          ...
                          iasql_create_policy_statement(...) -- Statement N
                    );
```

### ER diagram for s3 example
![Proposed model for s3](./assets/004/s3_example.png)

And for Updating, we can equally have something like this:

```sql
UPDATE bucket set policy_id = iasql_create_policy( -- returns policy ID after creation
                                  'some_policy_name',
                                  '2012-10-17', -- nullable, defaults to 2012-10-17
                                  iasql_create_policy_statement( -- returns policy statement ID after creation
                                    'allow',
                                    'aws:arn:123456789012:bucket-resource',
                                    's3:GetObjects', -- comma separated list of actions
                                    '123456789012' -- comma separated list of principals
                                  ), -- Statement 1
                                  iasql_create_policy_statement(...), -- Statement 2
                                  ...
                                  iasql_create_policy_statement(...) -- Statement N
                        ) WHERE id = '<bucket_id>';
```

These functions can be used to create policies for any AWS service (SQS, VPC, SNS etc.). We can also add more functions to create policies for
services in other clouds like GCP, Azure (out of scope).

Now, once the JSON blob is generated from the `Policy` and `Statement` tables, the data in these tables are no longer needed.
We can choose to keep them but the tables will keep growing and will span lots of records in no time, considering that once
the tables get large enough, it becomes more convenient to create new Statement records instead of querying to see what's reusable.
I lean towards dropping the relations they have with the entity table and deleting them, once the JSON blob is generated. Although a periodic bulk-delete is cheaper.
On the other hand, we can choose to keep these records and give the customer the option to reuse policies and statements
but then this means there would be two sources of truth for entity policies, and we would always have to keep then in sync. Not to mention that it is confusing to the user.

Upside:
* has validations on policy create time
* allows user enter policies in the regular copy-paste JSON way and through functions/relations

Downsides:
* 2 sources of truth for policies
* adds complexity, because we have to manage relations between Entity, Policy and Statement tables and also keep them in sync with the policy_document columns.

* **TABLES-ONLY approach**
This is the purely relational approach, similar to the **TABLES-WITH-FUNCTIONS approach** but without the functions `iasql_create_policy` and `iasql_create_statement` functions. 
In this approach, the user will only interact with tables directly. There will be Tables for `Policy` and `Statement`.
We will drop the `policy_document` column in the entities and use the `policy_id` column that serves as a FK to the `Policy` table (Many-To-One relationship) as the single source of truth.
The statement table will have a `policy_id` column that serves as a FK to the `Policy` table (Many-To-One relationship).
When the user runs `sync`, a function will be responsible for creating the entries in the `Policy` and `Statement` table and adding the `policy_id` to the entity table.

```js
// I believe these would be in `TypeScript`, not `plpgsql`

    sync() {
     ...
     let statementEntriesToCreate = [];
     
     for entity of entities {
        // generate JSON from `Policy` and `Statement` tables.
        // compare with cloud JSON
         
        if (different) {
           const policyId = {/...create entry in `Policy` table.../}
           
           statements.forEach(statement => {
              statementEntriesToCreate.push({
                 sid: statement.sid,
                 effect: statement.effect,
                 actions: getActionsInTableFormat(statement.actions),
                 resource: statement.resource,
                 principal: getPrincipalInTableFormat(statement.principal),
                 conditions: getConditionsInTableFormat(statement.conditions),
                 policy_id: policyId
              });
           });
        }
     }

     // create entries in `Statement` table
     db.insert(statementEntriesToCreate)

     // update the `policy_id` column in the entity table
     
    }
    
    apply() {
     ...
     // generate JSON from `Policy` and `Statement` tables
     // update cloud provider
    }
```

for this approach, the user will interact with the product like so

```sql
-- User creates bucket with the policy
insert into policy (
        name,
        version
    ) values (
              'some_policy',
              '2012-10-17' -- nullable, default to '2012-10-17'
            );

insert into statement (
                       policy_id,
                       sid,
                       effect,
                       actions,
                       conditions,
                       resource,
                       principal
                    ) values (
                        <policy_id>,
                        'statement1',
                        'allow',
                        's3:ListBucket, s3:GetObject',
                        '{{"aws:CurrentTime", "DateGreaterThan", "2021-01-01"}, {...}}',
                        'arn:aws:s3:::some_bucket',
                        '{{"AWS", "122345667443"}, {...}}'
                    );

insert into bucket (
        name,
        policy_id
    ) values (
              'some_bucket',
              <policy_id>
            );
```

For validations, we can use a trigger on insert/update to the `Policy` and `Statement` tables to match the values against pre-defined regular expressions.


Upside
* has validations on policy create time

Downsides of this approach:
* adds complexity, because we have to manage relations between Entity, Policy and Statement tables
* user can no longer copy-paste regular JSON if they choose to

## Expected Semver Impact

Minor update

## Affected Components
`aws_iam` module
`aws_s3` module
`aws_vpc` module

## Expected Timeline
TBD
