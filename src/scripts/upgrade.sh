#!/bin/bash

set -vx

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
		echo Checking $DB ...

    # Check if the database actually exists. There is a brief period during the database rename
    # operation where if the server went down *exactly* at that point the swap may have failed.
    # In that case, restore the `OLD_<db>` and delete a `NEW_<db>` if it exists
    HAS_NORMAL=$(psql iasql_metadata -qtc "
      SELECT datname FROM pg_database WHERE datname = '$DB';
    " | xargs)
    HAS_OLD=$(psql iasql_metadata -qtc "
      SELECT datname FROM pg_database WHERE datname = 'OLD$DB';
    " | xargs)
    HAS_NEW=$(psql iasql_metadata -qtc "
      SELECT datname FROM pg_database WHERE datname = 'NEW$DB';
    " | xargs)

    if [ "$HAS_OLD" != "" -a "$HAS_NORMAL" == "" ]; then
      # Rename the OLD back to normal and try again
      psql iasql_metadata -qtc "
        ALTER DATABASE \"OLD$DB\" RENAME TO \"$DB\";
      "
    fi

    if [ "$HAS_NEW" != "" ]; then
      # No matter what don't trust a NEW DB that didn't get renamed, probably a migration failure
      psql iasql_metadata -qtc "
        DROP DATABSE \"NEW$DB\";
      "
    fi

		# Get the engine and DB versions, figure out which is the newest and if that newest version is
		# a beta release. *Always* re-run the upgrade on beta releases, and if not a beta release, run
		# the upgrade only if the DB is an earlier version than the engine

		ENGINE_VERSION=$(jq -r .version /engine/package.json | xargs) # xargs is the recommended way to 'trim' strings. Oh Bash...

		DB_VERSION=$(psql $DB -qtc "
			SELECT split_part(name, '@', 2) FROM iasql_module LIMIT 1;
		" | xargs)

		LATEST_VERSION=$(/engine/node_modules/.bin/semver $ENGINE_VERSION $DB_VERSION | tail -n 1 | xargs)

		[[ "$LATEST_VERSION" == *"-beta" ]]
		IS_BETA_VERSION=$?

		[[ "$DB_VERSION" == "$LATEST_VERSION" ]]
		DB_IS_LATEST=$?

		SHOULD_UPGRADE=$IS_BETA_VERSION || ! $DB_IS_LATEST

		if [[ $SHOULD_UPGRADE ]]; then
			echo $DB to be upgraded!

      # The upgrade logic at this point is super simple: Just rename the database to OLD_<db>
      psql iasql_metadata -qtc "
        ALTER DATABASE \"$DB\" RENAME TO \"OLD$DB\";
      "

      echo Part 1 of 3 for $DB complete!
		fi
	done
fi