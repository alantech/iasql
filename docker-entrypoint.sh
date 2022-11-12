#!/usr/bin/env bash

set -vex

if [ -d /var/lib/postgresql/13/main ]; then
  chown -R postgres /var/lib/postgresql/13/main
  chgrp -R postgres /var/lib/postgresql/13/main
fi

service postgresql start

su - postgres -c "psql -c \"ALTER ROLE postgres WITH password '$(node ./dist/scripts/from-config.js db.password)'\""
su - postgres -c "echo \"SELECT 'CREATE DATABASE iasql_metadata' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'iasql_metadata')\gexec\" | psql"

service postgresql restart

yarn forever -f dist/services/scheduler.js &
yarn wait-on http://localhost:14527/health/
yarn start
