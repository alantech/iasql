#!/bin/bash

# Fail on error
set -e

# connect `iasql` db to aws account for `apply`
echo "\nCreating an iasql db..."
connectres=$(psql "postgres://postgres:test@localhost:5432/iasql_metadata" -t -c "SELECT json_agg(c)->0 FROM iasql_connect('iasql') as c;")
export IASQL_USERNAME=$(jq -r '.user' <<<"$connectres")
export IASQL_PASSWORD=$(jq -r '.password' <<<"$connectres")

CONNSTR="postgres://postgres:test@localhost:5432/iasql"

# Setup Account
echo "\nInstalling aws_account..."
psql $CONNSTR -c "
  select iasql_install(
    'aws_account'
  );
";

echo "\nAttaching credentials..."
psql $CONNSTR -c "
  INSERT INTO aws_credentials (access_key_id, secret_access_key)
  VALUES ('${AWS_ACCESS_KEY_ID}', '${AWS_SECRET_ACCESS_KEY}');
";

psql $CONNSTR -c "
  SELECT * FROM iasql_begin();
";

psql $CONNSTR -c "
  SELECT * FROM iasql_commit();
";

psql $CONNSTR -c "
  SELECT * FROM default_aws_region('${AWS_REGION}');
";

echo "\nDebug log..."
psql $CONNSTR -c "
  SELECT * FROM aws_regions;
";

echo "\nInstalling modules in iasql db..."
psql $CONNSTR -c "
  SELECT iasql_install(
    'aws_ecs_simplified', 'aws_codebuild'
  );
";
