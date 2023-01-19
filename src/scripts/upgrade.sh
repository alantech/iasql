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

# Check if there's any tables in the metadata database, in case this is a first-time run
HAS_IASQL_DATABASE=$(psql iasql_metadata -qtc "
	SELECT table_name
	FROM information_schema.tables
	WHERE table_name = 'iasql_database';
")

if [ "$HAS_IASQL_DATABASE" != "" ]; then
	# Get all user database names
	USER_DATABASES=$(psql iasql_metadata -qtc "
		SELECT pg_name
		FROM iasql_database;
	")
	for DB in $USER_DATABASES
	do
		echo $DB

		# TODO: Check the database's version to see if it should be upgraded or not

		# TODO 2: For now just show the outputs of these various queries, actually start deleting stuff later

		# Triggers
		TRIGGERS=$(psql $DB -qtc "
			SELECT pg_proc.proname
			FROM pg_proc
			INNER JOIN pg_type ON pg_type.oid = pg_proc.prorettype
			INNER JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
			WHERE pg_type.typname = 'trigger' AND pg_namespace.nspname = 'public';
		")
		echo $TRIGGERS

		# Other functions
		FUNCS=$(psql $DB -qtc "
			SELECT pg_proc.proname
			FROM pg_proc
			INNER JOIN pg_type ON pg_type.oid = pg_proc.prorettype
			INNER JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
			INNER JOIN pg_proc p2 ON pg_type.typoutput = p2.oid
			WHERE p2.proname != 'trigger_out'
			  AND pg_namespace.nspname = 'public'
			  AND NOT starts_with(pg_proc.prosrc, pg_proc.proname)
			  AND NOT starts_with(pg_proc.proname, pg_proc.prosrc);
		")
		echo $FUNCS

		# All indexes (probably won't use it, I think)
		# SELECT indexname
		# FROM pg_indexes
		# WHERE schemaname = 'public'
		# ORDER BY tablename, indexname;

		# Foreign key indexes
		FKS=$(psql $DB -qtc "
			SELECT DISTINCT constraint_name
			FROM information_schema.referential_constraints;
		");
		echo $FKS;

		# Non-foreign key indexes
		PKS=$(psql $DB -qtc "
			SELECT DISTINCT kcu.constraint_name
			FROM information_schema.key_column_usage kcu
			LEFT OUTER JOIN information_schema.referential_constraints rc ON rc.constraint_name = kcu.constraint_name
			WHERE kcu.constraint_schema = 'public' AND rc.constraint_name IS NULL;
		")
		echo $PKS

		# Tables
		TABLES=$(psql $DB -qtc "
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public';
		")
		echo $TABLES

		# Enums
		ENUMS=$(psql $DB -qtc "
			SELECT DISTINCT t.typname as enum_name
			FROM pg_type t
			INNER JOIN pg_enum e ON t.oid = e.enumtypid
			INNER JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
			WHERE n.nspname = 'public';
		")
		echo $ENUMS
	done
fi