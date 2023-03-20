#!/bin/bash

# This script assumes it will be invoked by 'yarn' through a 'package.json' command, making the CWD
# the same as the directory housing the 'package.json' file. It is not guaranteed to work in any
# other CWD.

# Give the module being worked on a special name for clearer referencing
MODULE=$1

set -vex

# Make sure there's no cruft left over, we need a blank postgres
docker container prune -f
docker volume prune -f
docker image prune -f

# Start a postgres container
docker container run -p 5432:5432 -e POSTGRES_PASSWORD=test --name migrate-postgres -d postgres:14.7

sleep 5 # Just in case
psql postgresql://postgres:test@localhost:5432/postgres -c "CREATE DATABASE __example__"

# Now, we need to move out of the root directory to pull our trickery below
cd src

# Get the list of modules this module depends upon and include itself for use in the temporary
# TypeORM configuration
MODULES=`ts-node scripts/list-deps ${MODULE}`
MODARR=($(echo ${MODULES} | sed 's/:/\n/g'))
#readarray -d ":" -t MODARR <<< "${MODULES}"

# Convert the array of modules into configuration paths for TypeORM
ENTITIES=""
MIGRATIONS=""
NL=$'\n'
for (( n=0; n < ${#MODARR[*]}; n++))
do
  MOD=`echo ${MODARR[n]} | xargs`
  ENTITIES="${ENTITIES}\"modules/${MOD}/entity/*.ts\",${NL}"
  MIGRATIONS="${MIGRATIONS}\"modules/${MOD}/migration/*.ts\",${NL}"
done

# Generate a DataSource file
cat <<EOF > datasource.ts
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { DataSource } from "typeorm";

export const dataSource = new DataSource({
 "type": "postgres",
 "host": "localhost",
 "port": 5432,
 "username": "postgres",
 "password": "test",
 "database": "__example__",
 "synchronize": true,
 "logging": false,
 "entities": [
  ${ENTITIES}
 ],
 "migrationsTableName": "__migrations__",
 "migrations": [
  ${MIGRATIONS}
 ],
 namingStrategy: new SnakeNamingStrategy(),
});
EOF

# First, run all migrations that already exist (required because we blew it all away before, but
# also keeps things clean because we don't accidentally break the migration generation with bad
# cruft in the database)
ts-node scripts/migrate-dep-order ${MODULE}

# Blow away the existing migration for the specified module, if one exists
rm -rf modules/${MODULE}/migration
mkdir modules/${MODULE}/migration

# Now run the migration generation for the module
ts-node ../node_modules/.bin/typeorm migration:generate -d datasource.ts modules/${MODULE}/migration/${MODULE}

# Clean up the temporary files and docker containers
rm datasource.ts
docker container stop migrate-postgres

# And we're done!
echo Done!
