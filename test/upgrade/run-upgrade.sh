#!/bin/bash

# Be 'vex'ing in the output volume
set -vex

# Make sure the test will work at all
if [ ! -f "${PWD}/docker-compose.yml" ]; then
  echo "Must be run from repo root";
  exit 1;
fi

# Get metadata on the current branch to use during the test
LATESTVERSION=`./node_modules/.bin/ts-node src/scripts/latestVersion.ts`
OLDESTVERSION=`./node_modules/.bin/ts-node src/scripts/oldestVersion.ts`
CURRENTGITSHA=`git rev-parse HEAD`

# Github Actions apparently doesn't pull down the tags by default?
git pull origin --tags

# Check out the older version of the codebase and launch the engine with a local postgres
git checkout v${OLDESTVERSION}
yarn docker-compose
yarn wait-on http://localhost:8088/health/

# Create a new database connected to a test account
curl http://localhost:8088/v1/db/connect/to_upgrade
psql postgres://postgres:test@127.0.0.1:5432/to_upgrade -c "
  select iasql_install(
    'aws_account'
  );
";
psql postgres://postgres:test@127.0.0.1:5432/to_upgrade -c "
  INSERT INTO aws_credentials (access_key_id, secret_access_key)
  VALUES ('${AWS_ACCESS_KEY_ID}', '${AWS_SECRET_ACCESS_KEY}');
";
psql postgres://postgres:test@127.0.0.1:5432/to_upgrade -c "
  SELECT * FROM iasql_sync();
";
psql postgres://postgres:test@127.0.0.1:5432/to_upgrade -c "
  SELECT * FROM default_aws_region('us-east-1');
";

# Shut down the database and engine, switch back to the current commit, and fire up a new engine
docker container stop $(basename ${PWD})_change_engine_1
docker container stop $(basename ${PWD})_postgresql_1
git checkout ${CURRENTGITSHA}
yarn docker-compose

# Actually trigger the upgrade and loop until upgraded (or fail)
psql postgres://postgres:test@127.0.0.1:5432/to_upgrade -c "
  SELECT * FROM iasql_upgrade();
";
UPGRADECHECKCOUNT=30
ISUPGRADED=false
while [ ${UPGRADECHECKCOUNT} -gt 0 ]; do
  AWSACCOUNTMODULE=`psql postgres://postgres:test@127.0.0.1:5432/to_upgrade -AXqtc "
    SELECT name FROM iasql_module WHERE name like 'aws_account*'
  "`
  if [ "${AWSACCOUNTMODULE}" == "aws_account@${LATESTVERSION}" ]; then
    ISUPGRADED=true
    UPGRADECHECKCOUNT=0
  fi
done

# The actual check!
if [ "${ISUPGRADED}" == "false" ]; then
  echo "Did not successfully upgrade!";
  exit 2;
else
  echo "Successfully upgraded!";
fi