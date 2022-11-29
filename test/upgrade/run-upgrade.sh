#!/bin/bash

# Be 'vex'ing in the output volume
set -vex

# Make sure the test will work at all
if [ ! -f "${PWD}/CONTRIBUTING.md" ]; then
  echo "Must be run from repo root"
  exit 1
fi

# Get metadata on the current branch to use during the test
LATESTVERSION=$(./node_modules/.bin/ts-node src/scripts/latestVersion.ts)
AVAILABLEVERSIONS=$(./node_modules/.bin/ts-node src/scripts/availableVersions.ts)
CURRENTGITSHA=$(git rev-parse HEAD)

# Github Actions apparently doesn't pull down the tags by default?
git pull origin --tags ${CURRENTGITSHA}

IFS=',' read -r -a availableVersions <<<"$AVAILABLEVERSIONS"
len=${#availableVersions[@]}
i=0
while [ $i -lt $(($len - 1)) ]; do
  # Clear mutations, if any
  git reset --hard HEAD
  echo "Upgrading from version ${availableVersions[$i]} to ${LATESTVERSION}"
  # Check out the older version of the codebase and launch the engine with a local postgres
  git checkout v${availableVersions[$i]}
  mkdir -p ${PWD}/../db
  if [ -f "${PWD}/docker-compose.yml" ]; then
    # Hack to mount a local directory for postgres so we can then re-mount it into the engine docker
    echo "    volumes:" >> ${PWD}/docker-compose.yml
    echo "      - $(dirname ${PWD})/db:/var/lib/postgresql/data" >> ${PWD}/docker-compose.yml
    yarn docker-compose &
  else
    yarn docker-build
    yarn docker-run-vol &
  fi
  yarn wait-on http://localhost:8088/health/

  # Connection string
  if [ -f "${PWD}/docker-compose.yml" ]; then
    CONNSTR="postgres://postgres:test@127.0.0.1:5432/to_upgrade"
  else
    CONNSTR="postgres://postgres:test@127.0.0.1:5432/to_upgrade?ssl=true&sslmode=require"
  fi

  # Create a new database connected to a test account
  curl http://localhost:8088/v1/db/connect/to_upgrade
  psql $CONNSTR -c "
      select iasql_install(
        'aws_account'
      );
    "

  # Determine which kind of 'aws_account' module this is (TODO: Remove this branch once v0.0.19 is oldest)
  AWSACCOUNTTABLE=$(psql $CONNSTR -AXqtc "
      SELECT \"table\" FROM iasql_tables WHERE \"table\" = 'aws_account';
    ")
  if [ "${AWSACCOUNTTABLE}" == "aws_account" ]; then # It's the old style
    psql $CONNSTR -c "
        INSERT INTO aws_account (access_key_id, secret_access_key, region)
        VALUES ('${AWS_ACCESS_KEY_ID}', '${AWS_SECRET_ACCESS_KEY}', 'us-east-1');
      "
  else
    psql $CONNSTR -c "
        INSERT INTO aws_credentials (access_key_id, secret_access_key)
        VALUES ('${AWS_ACCESS_KEY_ID}', '${AWS_SECRET_ACCESS_KEY}');
      "
    # Delete when 0.0.23 is the oldest
    if [[ "${availableVersions[$i]}" < "0.0.23" ]]; then
      psql $CONNSTR -c "
          SELECT * FROM iasql_sync();
        "
    else
      psql $CONNSTR -c "
          SELECT * FROM iasql_commit();
        "
    fi
    psql $CONNSTR -c "
        SELECT * FROM default_aws_region('us-east-1');
      "
  fi

  # Add one module that we can use to verify that everything actually comes back up
  psql $CONNSTR -c "
      SELECT * FROM iasql_install('aws_ec2');
    "

  # Shut down the database and engine, switch back to the current commit, and fire up a new engine
  if [ -f "${PWD}/docker-compose.yml" ]; then
    docker container stop $(basename ${PWD})_change_engine_1
    docker container stop $(basename ${PWD})_postgresql_1
  else
    docker container stop iasql
    docker container prune -f
  fi
  # Clear mutations, if any
  git reset --hard HEAD
  git checkout ${CURRENTGITSHA}

  # Remake Connection string on each checkout
  if [ -f "${PWD}/docker-compose.yml" ]; then
    CONNSTR="postgres://postgres:test@127.0.0.1:5432/to_upgrade"
  else
    CONNSTR="postgres://postgres:test@127.0.0.1:5432/to_upgrade?ssl=true&sslmode=require"
  fi

  mkdir -p ${PWD}/../db
  if [ -f "${PWD}/docker-compose.yml" ]; then
    # Hack to mount a local directory for postgres so we can then re-mount it into the engine docker
    echo "    volumes:" >> ${PWD}/docker-compose.yml
    echo "      - $(dirname ${PWD})/db:/var/lib/postgresql/data" >> ${PWD}/docker-compose.yml
    yarn docker-compose &
  else
    yarn docker-build
    yarn docker-run-vol &
  fi
  yarn wait-on http://localhost:8088/health/

  # Actually trigger the upgrade and loop until upgraded (or fail)
  psql $CONNSTR -c "
      SELECT * FROM iasql_upgrade();
    "
  UPGRADECHECKCOUNT=30
  ISUPGRADED=false
  while [ ${UPGRADECHECKCOUNT} -gt 0 ]; do
    AWSACCOUNTMODULE=$(psql $CONNSTR -AXqtc "
        SELECT name FROM iasql_module WHERE name like 'aws_account%'
      ")
    if [ "${AWSACCOUNTMODULE}" == "aws_account@${LATESTVERSION}" ]; then
      ISUPGRADED=true
      UPGRADECHECKCOUNT=0
    fi
    sleep 1
    UPGRADECHECKCOUNT=$((${UPGRADECHECKCOUNT} - 1))
  done

  # The check that the upgrade successfully loads up the new version for the account
  if [ "${ISUPGRADED}" == "false" ]; then
    echo "Did not successfully upgrade from version ${availableVersions[$i]} to ${LATESTVERSION}!"
    exit 2
  fi

  # Another loop to wait for the `aws_ec2` module to load
  EC2CHECKCOUNT=30
  EC2UPGRADED=false
  while [ ${EC2CHECKCOUNT} -gt 0 ]; do
    AWSEC2MODULE=$(psql $CONNSTR -AXqtc "
        SELECT name FROM iasql_module WHERE name like 'aws_ec2%'
      ")
    if [ "${AWSEC2MODULE}" == "aws_ec2@${LATESTVERSION}" ]; then
      EC2UPGRADED=true
      EC2CHECKCOUNT=0
    fi
    sleep 1
    EC2CHECKCOUNT=$((${EC2CHECKCOUNT} - 1))
  done

  # The check that the upgrade successfully loads up the new version for the `aws_ec2` module
  if [ "${EC2UPGRADED}" == "false" ]; then
    echo "Did not successfully upgrade from version ${availableVersions[$i]} to ${LATESTVERSION}!"
    exit 3
  fi

  # Force new RPC run
  # Another loop to wait for engine to be receptive
  RPCCHECKCOUNT=30
  RPCUPGRADED=false
  while [ ${RPCCHECKCOUNT} -gt 0 ]; do
    AWSRPCCALL=$(psql $CONNSTR -c "
        SELECT * FROM iasql_modules_list();
      " || true)
    if [ "${AWSRPCCALL}" != "" ]; then
      RPCUPGRADED=true
      RPCCHECKCOUNT=0
    fi
    sleep 1
    RPCCHECKCOUNT=$((${RPCCHECKCOUNT} - 1))
  done

  if [ "${RPCUPGRADED}" == "false" ]; then
    echo "Did not successfully upgrade from version ${availableVersions[$i]} to ${LATESTVERSION}!"
    exit 4
  fi

  echo "Successfully upgraded from ${availableVersions[$i]} to ${LATESTVERSION}!"
  # Shut down the database and engine, switch back to the current commit, and fire up a new engine
  curl http://localhost:8088/v1/db/disconnect/to_upgrade
  if [ -f "${PWD}/docker-compose.yml" ]; then
    docker container stop $(basename ${PWD})_change_engine_1
    docker container stop $(basename ${PWD})_postgresql_1
  else
    docker container stop iasql
    docker container prune -f
  fi
  i=$(($i + 1))
done
