#!/bin/bash

# Fail on error
set -e

# connect `iasql` db to aws account for `apply`
echo "\nCreating an iasql db..."
connectres=$(curl http://localhost:8088/v1/db/connect/iasql)
echo "\n seting up database with username and password"
echo $(jq -r '.user' <<<"$connectres")
echo $(jq -r '.password' <<<"$connectres")
export IASQL_USERNAME=$(jq -r '.user' <<<"$connectres")
export IASQL_PASSWORD=$(jq -r '.password' <<<"$connectres")

# Setup Account
echo "\nInstalling aws_account..."
psql postgres://postgres:test@localhost:5432/iasql -c "
  select iasql_install(
    'aws_account'
  );
";

echo "\nAttaching credentials..."
psql postgres://postgres:test@localhost:5432/iasql -c "
  INSERT INTO aws_credentials (access_key_id, secret_access_key)
  VALUES ('${AWS_ACCESS_KEY_ID}', '${AWS_SECRET_ACCESS_KEY}');
";

psql postgres://postgres:test@localhost:5432/iasql -c "
  SELECT * FROM iasql_commit();
";

psql postgres://postgres:test@localhost:5432/iasql -c "
  SELECT * FROM default_aws_region('${AWS_REGION}');
";

echo "\nDebug log..."
psql postgres://postgres:test@localhost:5432/iasql -c "
  SELECT * FROM aws_regions;
";

echo "\nInstalling modules in iasql db..."
psql postgres://postgres:test@localhost:5432/iasql -c "
  SELECT iasql_install(
    'aws_ecs_simplified'
  );
";
