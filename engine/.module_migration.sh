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
psql postgresql://postgres:test@localhost/postgres -c "CREATE DATABASE __example__"

# Now, we need to move out of the root directory to pull our trickery below
cd src

cat <<EOF > ormconfig.js
const { SnakeNamingStrategy } = require('typeorm-naming-strategies');

console.log('I am being run!');

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
  "src/entity/**/*.ts"
 ],
 "migrationsTableName": "__migrations__",
 "migrations": [
  "modules/**/migration/*.ts"
 ],
 "subscribers": [
  "modules/**/subscriber/*.ts"
 ],
 "cli": {
  "entitiesDir": "modules/${MODULE}/entity",
  "migrationsDir": "modules/${MODULE}/migration",
  "subscribersDir": "modules/${MODULE}/subscriber"
 },
 namingStrategy: new SnakeNamingStrategy(),
};
EOF

# First, run all migrations that already exist (required because we blew it all away before, but
# also keeps things clean because we don't accidentally break the migration generation with bad
# cruft in the database)
ts-node ../node_modules/.bin/typeorm migration:run

# Now run the migration generation for the module
ts-node ../node_modules/.bin/typeorm migration:generate -n ${MODULE}

# Clean up the temporary ormconfig.js file
rm ormconfig.js

# And we're done!
echo Done!
