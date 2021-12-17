---
sidebar_position: 1
---

# CLI API

```bash
Infrastructure as SQL

USAGE:
    iasql <SUBCOMMAND>

FLAGS:
    -h, --help       Prints help information
    -V, --version    Prints version information

SUBCOMMANDS:
    apply        Create, delete or update the resources in a db
    dbs          List all dbs
    export       Export a db dump to backup your infrastructure or import it into another db
    help         Prints this message or the help of the given subcommand(s)
    import       Create a db from a previously exported dump
    install      Install mods in a given db
    login        Obtain and save credentials for the IaSQL service
    logout       Remove locally-stored credentials for the IaSQL service
    mods         List all modules or list the modules installed in a given database
    new          Create a db to manage cloud resources
    plan         Display a preview of the resources in a db to be modified on the next `apply`
    remove       Remove a db and stop managing the cloud resources within it [aliases: rm]
    uninstall    Uninstall mods from a given db
```
