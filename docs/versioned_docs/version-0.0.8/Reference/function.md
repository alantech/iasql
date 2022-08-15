---
sidebar_position: 1
slug: '/function'
---

# IaSQL PostgreSQL Functions

| name               | signature                          | description                                                           | sample usage                                                |
| ------------------ | ---------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| apply              | `iasql_apply()`                    | Create, delete or update the cloud resources in a hosted db           | `SELECT * FROM iasql_apply()`                               |
| plan_apply         | `iasql_plan_apply()`               | Preview of the resources in the db to be modified on the next `apply` | `SELECT * FROM iasql_plan_apply()`                          |
| sync               | `iasql_sync()`                     | Synchronize the db with the current state of the cloud account        | `SELECT * FROM iasql_sync()`                                |
| plan_sync          | `iasql_plan_sync()`                | Preview of the resources in the db to be modified on the next `sync`  | `SELECT * FROM iasql_plan_sync()`                           |
| install            | `iasql_install(variadic text[])`   | Install mods(s) in db and returns a record for every created table    | `SELECT * FROM iasql_install('aws_vpc@0.0.1', 'aws_ec2')`   |
| uninstall          | `iasql_uninstall(variadic text[])` | Uninstall mod(s) in db and returns a record for every dropped table   | `SELECT * FROM iasql_uninstall('aws_vpc', 'aws_ec2@0.0.1')` |
| modules_list       | `iasql_modules_list()`             | Lists all modules available to be installed                           | `SELECT * FROM iasql_modules_list()`                        |
| modules_installed  | `iasql_modules_installed()`        | Lists all modules currently installed in the db                       | `SELECT * FROM iasql_modules_installed()`                   |
| delete_all_records | `delete_all_records()`             | Delete all records in tables managaed by iasql modules                | `SELECT * FROM delete_all_records()`                        |
| help               | `iasql_help()`                     | Delete all records in iasql managed tables                            | `SELECT * FROM delete_all_records()`                        |