#!/bin/bash

# Be 'vex'ing in the output volume
set -vex

# Make sure the test will work at all
if [ ! -f "${PWD}/CONTRIBUTING.md" ]; then
  echo "Must be run from repo root"
  exit 1
fi

# Github Actions apparently doesn't pull down the tags by default?
CURRENTGITSHA=$(git rev-parse HEAD)
git pull origin --tags ${CURRENTGITSHA}

# Get metadata on the current branch to use during the test
CURRENTVERSION=$(jq -r .version package.json)
PRIORVERSION=$(./node_modules/.bin/semver $(git tag -l) | tail -n 1)

# Clear mutations, if any
git reset --hard HEAD
echo "Upgrading from version ${PRIORVERSION} to ${CURRENTVERSION}"

# Check out the older version of the codebase and launch the engine with a local postgres
git checkout v${PRIORVERSION}
mkdir -p ${PWD}/../db
yarn docker-build
yarn docker-run-vol &
while ! psql postgres://postgres:test@localhost:5432/iasql_metadata -b -q -c "SELECT iasql_engine_health()"; do sleep 1 && echo -n .; done;

# Create a new database connected to a test account
connectres=$(psql "postgres://postgres:test@localhost:5432/iasql_metadata" -t -c "SELECT json_agg(c)->0 FROM iasql_connect('to_upgrade') as c;")
username=$(jq -r '.user' <<<"$connectres")
password=$(jq -r '.password' <<<"$connectres")
CONNSTR="postgres://$username:$password@localhost:5432/to_upgrade"
psql $CONNSTR -c "
  select iasql_install(
    'aws_account'
  );
"

psql $CONNSTR -c "
  SELECT iasql_begin();
"
psql $CONNSTR -c "
  INSERT INTO aws_credentials (access_key_id, secret_access_key)
  VALUES ('${AWS_ACCESS_KEY_ID}', '${AWS_SECRET_ACCESS_KEY}');
"
psql $CONNSTR -c "
  SELECT * FROM iasql_commit();
"
psql $CONNSTR -c "
  SELECT * FROM default_aws_region('us-east-1');
"

# Add one module that we can use to verify that everything actually comes back up
psql $CONNSTR -c "
  SELECT * FROM iasql_install('aws_ec2');
"

# Shut down the database and engine, switch back to the current commit, and fire up a new engine
docker container stop iasql
docker container prune -f

# Clear mutations, if any
git reset --hard HEAD
git checkout ${CURRENTGITSHA}

mkdir -p ${PWD}/../db
yarn docker-build
yarn docker-run-vol &
while ! psql postgres://postgres:test@localhost:5432/iasql_metadata -b -q -c "SELECT iasql_engine_health()"; do sleep 1 && echo -n .; done;

UPGRADECHECKCOUNT=300
ISUPGRADED=false
while [ ${UPGRADECHECKCOUNT} -gt 0 ]; do
  AWSACCOUNTMODULE=$(psql $CONNSTR -AXqtc "
    SELECT name FROM iasql_module WHERE name like 'aws_ec2%'
  " || echo nope)
  if [ "${AWSACCOUNTMODULE}" == "aws_ec2@${CURRENTVERSION}" ]; then
    ISUPGRADED=true
    UPGRADECHECKCOUNT=0
  fi
  sleep 1
  UPGRADECHECKCOUNT=$((${UPGRADECHECKCOUNT} - 1))
done

# The check that the upgrade successfully loads up the new version for the account
if [ "${ISUPGRADED}" == "false" ]; then
  echo "Did not successfully upgrade from version ${PRIORVERSION} to ${CURRENTVERSION}!"
  exit 2
fi

echo "Successfully upgraded from ${PRIORVERSION} to ${CURRENTVERSION}!"

