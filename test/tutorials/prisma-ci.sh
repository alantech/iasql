#!/bin/bash

# Fail on error
set -e

echo "\nUsing ${AWS_REGION} region"

echo "\nSet working directory to iasql/examples/ecs-fargate/prisma/infra"
cd examples/ecs-fargate/prisma/infra

# Install npm modules
echo "\nInstall npm modules"
npm i

echo "\nCreate a basic schema.prisma file"
mkdir prisma
touch prisma/schema.prisma
echo 'datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}' >> prisma/schema.prisma

echo "\nIntrospect schema"
npx prisma db pull

echo "\nGenerate prisma client"
npx prisma generate

echo "\nRun script"
node index.js

echo "\nGet DNS name..."
export DNS_NAME=$(psql "postgres://postgres:test@localhost:5432/iasql" -AXqtc "
SELECT load_balancer_dns
FROM ecs_simplified
WHERE app_name = 'quickstart';");

wait-for-url() {
  echo "Testing $1"
  timeout -s TERM 360 bash -c \
  'while [[ "$(curl -s -o /dev/null -L -w ''%{http_code}'' ${0})" != "200" ]];\
  do echo "Waiting for ${0}" && sleep 5;\
  done' ${1}
  echo "OK!"
  curl -I $1
}

wait-for-url ${DNS_NAME}:8088/health