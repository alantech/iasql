---
sidebar_position: 3
---

# Inspect stored procedures

IaSQL provides multiple [Postgres used-defined stored procedures](https://www.postgresql.org/docs/current/xproc.html) with each module, or cloud service, you add to your db to help you simplify and DRY out your infrastructure declarations. It is also possible for you to define your own stored procedures!

To view all user-defined stored procedures, [connect to your db](/connect) using `psql` and run:

```sql
_yourdb=>\df                                                                                            
```

To see a full SQL declaration of a stored procedure run the following query and replace `proc_name` with the name of the stored procedure you are interested in:

```sql
SELECT
  pg_get_functiondef(
    (SELECT oid FROM pg_proc WHERE proname = 'proc_name')
  );
```