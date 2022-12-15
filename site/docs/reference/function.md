---
sidebar_position: 1
slug: '/function'
---

# IaSQL PostgreSQL Functions

<!-- TODO generate this table automatically from the same output as iasql_help -->

| name               | signature                          | description                                                                          | sample usage                                          |
| ------------------ | ---------------------------------- |--------------------------------------------------------------------------------------|-------------------------------------------------------|
| begin              | `iasql_begin()`                    | Begin an IaSQL [transaction](../concepts/transaction.md)                             | `SELECT * FROM iasql_begin()`                         |
| preview            | `iasql_preview()`                  | Preview the result of the ongoing IaSQL [transaction](../concepts/transaction.md)    | `SELECT * FROM iasql_preview()`                       |
| commit             | `iasql_commit()`                   | Commit changes done to the database by creating, updating or deleting cloud resources| `SELECT * FROM iasql_commit()`                        |
| rollback           | `iasql_rollback()`                 | Rollback changes done to the database by synchronizing cloud resources               | `SELECT * FROM iasql_rollback()`                      |
| get_errors         | `get_errors()`                     | Get latest error messages ocurred during a commit or a rollback                      | `SELECT * FROM get_errors()`
| install            | `iasql_install(variadic text[])`   | Install mods(s) in db and returns a record for every created table                   | `SELECT * FROM iasql_install('aws_vpc', 'aws_ec2')`   |
| uninstall          | `iasql_uninstall(variadic text[])` | Uninstall mod(s) in db and returns a record for every dropped table                  | `SELECT * FROM iasql_uninstall('aws_vpc', 'aws_ec2')` |
| modules_list       | `iasql_modules_list()`             | Lists all modules available to be installed                                          | `SELECT * FROM iasql_modules_list()`                  |
| modules_installed  | `iasql_modules_installed()`        | Lists all modules currently installed in the db                                      | `SELECT * FROM iasql_modules_installed()`             |
| delete_all_records | `delete_all_records()`             | Delete all records in tables managaed by IaSQL modules                               | `SELECT * FROM delete_all_records()`                  |
| help               | `iasql_help()`                     | Lists IaSQL functions, their description and sample usage                            | `SELECT * FROM iasql_help()`                          |