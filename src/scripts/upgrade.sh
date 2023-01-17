#!/bin/bash

# Upgrade steps:
# 1. For each user database
#    2. Get installed modules and query out "special" data (just `aws_account` and audit log, I think)
#    3. Get a listing of all triggers in `public` and delete them.
#    4. Get a listing of all functions in `public` and delete them.
#    5. Get a listing of all indexes in `public` and delete them.
#    6? If deleting indexes doesn't break joins between tables, alter all FK columns to no longer join the other table.
#    7. Get a listing of all tables in `public` and delete them.
#    8. Get a listing of all enums in `public` and delete them.
#    9. Re-run most of the logic to create a new database, setting up the `iasql_*` modules
#   10. Re-install `aws_account` and re-insert the special data.
#   11. Re-install all of the remaining modules from the original list.
#
# These can be done massively in parallel to minimize total wall time, but steps 9-11 depend on engine code whereas 2-8 are pure SQL. It may make sense to do 2-8 for all databases, then spin up the engine and have the necessary information for steps 9-11 stored in `iasql_metadata` and done during initialization there? This would resolve the "small db has to wait on large dbs before resuming activity" issue, but may cause the large db users to be very worried about their database if they connect during that delay?
# Alternatively, instead of storing the logic there into the metadata database, maybe just fork a disconnected child process and sleep for a few seconds, then continue, running pure IaSQL code to do the rest? (Well, re-running the `up` migration code for the `iasql_*` modules would need to be done in the script, but that part could be hacked into the shell script since it doesn't depend on using the AWS SDK. Then the restoration of the database is IaSQL-powered SQL only.
# Note: The audit log data would be restored immediately after the `iasql_*` modules are added, but not sure if we can do that with a "normal" SQL script or if we need to do something special there to get it in.
# TODO: Also need to add an `UPGRADE` audit log type we can add in there to make it clear when prior logs are no longer fully "trustworthy" for the purposes of re-generating SQL statements from them.

echo TODO