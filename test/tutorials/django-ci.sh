#!/bin/bash

# Fail on error
set -e

echo "\nUsing ${AWS_REGION} region"

echo "\nSet working directory to examples/ecs-fargate/django/app/"
cd examples/ecs-fargate/django/app

# Install pip packages
echo "\nInstall pip packages"
pip install -r requirements.txt

# install ecs_simplified and codebuild modules
psql "postgres://$IASQL_USERNAME:$IASQL_PASSWORD@localhost:5432/iasql" -c "
  SELECT * FROM iasql_install(
      'aws_ecs_simplified', 'aws_codebuild'
  );
"

echo "\nRun Django migrations - no real action on the database"
python manage.py migrate --database infra infra

# create the ecs_simplified app
psql "postgres://$IASQL_USERNAME:$IASQL_PASSWORD@localhost:5432/iasql" -c "
  SELECT iasql_begin();
"
psql "postgres://$IASQL_USERNAME:$IASQL_PASSWORD@localhost:5432/iasql" -c "
  INSERT INTO ecs_simplified (app_name, public_ip, app_port, image_tag, cpu_mem, desired_count)
  VALUES ('quickstart', true, 8088, 'latest', 'vCPU2-8GB', 1);
"
psql "postgres://$IASQL_USERNAME:$IASQL_PASSWORD@localhost:5432/iasql" -c "
  SELECT iasql_commit();
"

psql "postgres://$IASQL_USERNAME:$IASQL_PASSWORD@localhost:5432/iasql" -c "
  SELECT ecr_build(
    '$GITHUB_SERVER_URL/$GITHUB_REPOSITORY',
    (SELECT id FROM repository WHERE repository_name = 'quickstart-repository')::varchar(255),
    './examples/ecs-fargate/django/app',
    '${GITHUB_REF}',
    '${GH_PAT}'
  );
"

# Get DNS name, Set PGPASSWORD environment variable to avoid interaction
echo "\nGet DNS name..."
export DNS_NAME=$(psql "postgres://postgres:test@localhost:5432/iasql" -AXqtc "
SELECT load_balancer_dns
FROM ecs_simplified
WHERE app_name = 'quickstart';")

wait-for-url() {
  echo "Testing $1"
  timeout -s TERM 360 bash -c \
    'while [[ "$(curl -s -o /dev/null -L -w ''%{http_code}'' ${0})" != "200" ]];\
  do echo "Waiting for ${0}" && sleep 5;\
  done' ${1}
  echo "OK!"
  curl -I $1
}

wait-for-url ${DNS_NAME}:8088/health/
