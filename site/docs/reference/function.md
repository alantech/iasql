---
sidebar_position: 1
slug: '/function'
---

# IaSQL PostgreSQL Functions

<!-- TODO generate this table automatically from the same output as iasql_help -->

| name        | signature             | description                                                     | sample usage
------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
 begin             | `iasql_begin()`                    | Starts a new IaSQL transaction. It marks the start of a set of changes that can be then applied into the database. | `SELECT * FROM iasql_begin()` |
 preview           | `iasql_preview()`                  | Preview of the resources in the db to be modified on the next `commit`                                             | `SELECT * FROM iasql_preview()` |
 commit            | `iasql_commit()`                   | Commit changes done to the database by creating, updating or deleting cloud resources                              | `SELECT * FROM iasql_commit()` |
 restore           | `iasql_restore()`                  | Restore database by synchronizing cloud resources                                                                  | `SELECT * FROM iasql_restore()` |
 get_errors        | `iasql_get_errors()`               | Get latest error messages ocurred during a commit or a rollback                                                    | `SELECT * FROM iasql_get_errors()` |
 install           | `iasql_install(variadic text[])`   | Install modules in the hosted db                                                                                   | `SELECT * FROM iasql_install('aws_vpc', 'aws_ec2')` |
 uninstall         | `iasql_uninstall(variadic text[])` | Uninstall modules in the hosted db                                                                                 | `SELECT * FROM iasql_uninstall('aws_vpc', 'aws_ec2')` |
 modules_list      | `iasql_modules_list()`             | Lists all modules available to be installed                                                                        | `SELECT * FROM iasql_modules_list()` |
 modules_installed | `iasql_modules_installed()`        | Lists all modules currently installed in the hosted db                                                             | `SELECT * FROM iasql_modules_installed()` |
 upgrade           | `iasql_upgrade()`                  | Upgrades the db to the latest IaSQL Platform                                                                       | `SELECT iasql_upgrade()` |
 version           | `iasql_version()`                  | Lists the currently installed IaSQL Platform version                                                               | `SELECT * from iasql_version()` |
