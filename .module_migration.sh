#!/bin/bash

# This script assumes it will be invoked by 'yarn' through a 'package.json' command, making the CWD
# the same as the directory housing the 'package.json' file. It is not guaranteed to work in any
# other CWD.

# Give the module being worked on a special name for clearer referencing
MODULE=$1

set -vex

# First, blow away all existing docker stuff so we're working with a clean slate
docker container prune -f
docker volume prune -f
docker image prune -f

# Next, spin them back up so we have a database
docker-compose up --build --detach
sleep 5 # Just in case
psql postgresql://postgres:test@localhost:5432/postgres -c "CREATE DATABASE __example__"

# Now, we need to move out of the root directory to pull our trickery below
cd src

# Blow away the existing migration for the specified module, if one exists
rm -rf modules/${MODULE}/migration

# Get the list of modules this module depends upon and include itself for use in the temporary
# TypeORM configuration
MODULES=`cat modules/${MODULE}/module.json | jq -r ".dependencies[.dependencies | length] |= \"${MODULE}\" | .dependencies | join(\":\")"`
readarray -d ":" -t MODARR <<< "${MODULES}"

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

# Generate the TypeORM config
cat <<EOF > ormconfig.js
const { SnakeNamingStrategy } = require('typeorm-naming-strategies');

module.exports = {
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
 "cli": {
  "entitiesDir": "modules/${MODULE}/entity",
  "migrationsDir": "modules/${MODULE}/migration",
 },
 namingStrategy: new SnakeNamingStrategy(),
};
EOF

# First, run all migrations that already exist (required because we blew it all away before, but
# also keeps things clean because we don't accidentally break the migration generation with bad
# cruft in the database)
ts-node ../node_modules/.bin/typeorm migration:run

# Now run the migration generation for the module
ts-node ../node_modules/.bin/typeorm migration:generate -n $(echo ${MODULE} | sed 's/@.*$//g')

# Clean up the temporary ormconfig.js file and docker containers
rm ormconfig.js
docker-compose down

# And we're done!
echo Done!
