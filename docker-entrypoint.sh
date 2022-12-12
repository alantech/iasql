#!/usr/bin/env bash

set -vex

env

if [ -d /var/lib/postgresql/14/main ]; then
  chown -R postgres /var/lib/postgresql/14/main
  chgrp -R postgres /var/lib/postgresql/14/main
fi

service postgresql start

su - postgres -c "psql -c \"ALTER ROLE postgres WITH password '$(node ./dist/scripts/from-config.js db.password)'\""
su - postgres -c "echo \"SELECT 'CREATE DATABASE iasql_metadata' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'iasql_metadata')\gexec\" | psql"

service postgresql restart

su - postgres -c "psql iasql_metadata -c \"CREATE EXTENSION IF NOT EXISTS pg_cron;\""
su - postgres -c "psql iasql_metadata -c \"GRANT EXECUTE ON FUNCTION cron.schedule_in_database(text,text,text,text,text,boolean) TO postgres;\""

yarn start
