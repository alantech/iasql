---
sidebar_position: 2
slug: '/module'
---

# Module

The concept of modules comes from programming languages, and is a distinct block of code that is well-isolated from other code and can be loaded with other modules and used together for some other purpose, like modular building blocks that you may have played with as a kid.

IaSQL Modules take the same concept and apply it to a Postgres Database. An IaSQL module consists of a collection of tables that are managed together by the module code, and collectively deal with a singular concept in your cloud. So unlike traditional migrations that have a linear history, IaSQL modules have an `install` and `uninstall` mechanism and your schema can be both up-to-date and different from another user's up-to-date schema, as they control different features within your cloud infra.

Modules are isolated, but they are no wholly self-contained; they may depend on other modules that need to be loaded before they do and have schema changes that hook into the other module, such as the `aws_ec2` module depending on the `aws_security_group` module to get the security group IDs it needs.

This means that modules represent a dependency tree, and IaSQL will follow that tree and automatically suggest which other modules are necessary to install the module you requested.

For those with a background in programming languages with modules, you'll know that there's two implementations of module systems, one in which a module's dependencies are isolated from each other so it is possible to have dependencies-of-dependencies that conflict with each other simultaneously installed, and those where all dependencies are placed into a singular pool of dependencies, and conflicting dependencies cannot be simultaneously installed. While it may sound less useful, IaSQL has chosen to go with the latter implementation for the following reasons:

1. Multiple tables that try to control the same cloud infrastructure represent a divided source-of-truth, and conflicting changes in these tables can easily become irreconcilable and your infrastructure management would not work.
2. Postgres has a 64 character limit on table names, and to isolate these tables from one another would require some sort of automatic table name generation that could theoretically work for the modules, but would be incomprehensible to you on what tables are used for what changes.

With modules that can conflict and not be installed simultaneously, we actually get the benefit that you cannot accidentally split the source of truth between tables and get into an irreconcilable state and we can let module authors use human-legible names for their tables so it is much simpler for you to find what table you need to change.

Because a module that is not installed simply means that IaSQL does not manage that piece of your cloud infrastructure, if you ever find an alternative module that you would like to use instead of your current one, you can simply uninstall the current module and then install the alternative and it will import the current state of your infrastructure into the schema of the new module for you automatically. No need to rewrite infrastructure-as-code files for the alternative module, and if you decide that the grass wasn't greener on the other side, you can just as easily swap back.

Modules are managed in IaSQL through the PostgreSQL functions loaded into every IaSQL database. As the [Tutorial](/blog/fargate) guide indicates, you pick which modules you wish to use once you connect to your IaSQL DB. You can see what modules are available to you using the `SELECT * FROM iasql_modules_list()` command. You can configure which modules are installed over time using the `SELECT * FROM iasql_install(...)` or ` SELECT * FROM iasql_uninstall(...)` commands. See the [IaSQL PostgreSQL Functions](../modules/builtin/iasql_functions.md) for more details.
