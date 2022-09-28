#!/bin/bash

# Fail on error
set -e

echo "\nUsing ${AWS_REGION} region"

echo "\nSet working directory to examples/ecs-fargate/django/app/"
cd ../../examples/ecs-fargate/django/app

# Install pip packages
echo "\nInstall pip packages"
pip install -r requirements.txt

echo "\nRun Django migrations"
python manage.py migrate --database infra infra

echo "\nGet the ECR URI"
export ECR_URI=$(psql postgres://postgres:test@localhost:5432/iasql -AXqtc "
SELECT repository_uri
FROM ecs_simplified
WHERE app_name = 'quickstart';")

echo "\nLogin to ECR"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}

echo "\nBuild image"
docker build -t quickstart-repository .

echo "\nPush image"
docker tag quickstart-repository:latest ${ECR_URI}:latest
docker push ${ECR_URI}:latest

# Get DNS name, Set PGPASSWORD environment variable to avoid interaction
echo "\nGet DNS name..."
export DNS_NAME=$(psql postgres://postgres:test@localhost:5432/iasql -AXqtc "
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
