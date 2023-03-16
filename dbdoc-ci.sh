## Prerequisites:
## - IaSQL running locally
## - Added a db called iasql using organization credentials
#!/bin/bash

# Fail on error
set -e

# IaSQL db connect
echo "\Connecting an iasql db..."
psql postgres://postgres:test@localhost:5432/iasql_metadata -c "SELECT * FROM iasql_connect('iasql');"

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
  SELECT * FROM default_aws_region('${AWS_REGION}');
";

# TODO how to install all and get latest engine version?
echo "\nInstalling all modules in iasql db..."
psql postgres://postgres:test@localhost:5432/iasql -c "
  select iasql_install(
    variadic array(select module_name from iasql_modules_list() where module_name != 'aws_account' and module_name not like 'iasql_%')
  );
";

echo "\nSet working directory to examples/ecs-fargate/prisma/infra"
cd examples/ecs-fargate/prisma/infra

# Install npm modules
echo "\nInstall npm modules"
npm install
npm install -D prisma-dbml-generator

echo "\nCreate a basic schema.prisma file"
mkdir prisma
echo 'datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

Project IaSQL {
  database_type: 'PostgreSQL'
  Note: '''
    [IaSQL](https://iasql.com) - Cloud infrastructure as data in PostgreSQL
  '''
}

generator dbml {
  provider = "prisma-dbml-generator"
  outputName = "iasql.dbml"
}' > prisma/schema.prisma

echo "\nIntrospect schema"
npx prisma db pull

echo "\nReplace unsupported types"
cat prisma/schema.prisma | sed 's/Unsupported..cidr../String/g' > prisma/out.prisma
rm prisma/schema.prisma; mv prisma/out.prisma prisma/schema.prisma

echo "\nGenerate dbml from prisma schema"
npx prisma generate

echo "\nUploading new dbml to dbdocs..."
dbdocs build prisma/dbml/iasql.dbml --project=iasql