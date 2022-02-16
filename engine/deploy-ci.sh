## Prerequisites:
## - Engine running locally
## - Added a db called iasql using organization credentials
## - PGPASSWORD environment variable defined in .deploy-env
## - DB_PASSWORD environment variable defined in .deploy-env
## - IRONPLANS_TOKEN environment variable defined in .deploy-env
## - AUTH_TOKEN environment variable defined in .deploy-env
## - AWS_REGION environment variable defined in .deploy-env
#!/bin/bash

# Fail on error
set -e

## get aws account id and create private registry and image URIs with it
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity | jq -r .Account)
export REGISTRY_URI=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
export IMAGE_URI=${REGISTRY_URI}/iasql-engine-repository
export LATEST_IMAGE_URI=${IMAGE_URI}:latest

# IaSQL db new. Using local debug version
echo "\Creating an iasql db..."
export $(cat .deploy-env | xargs) && cargo run --manifest-path=../cli/Cargo.toml -- new iasql --noninteractive

echo "\Installing modules in iasql db..."
cargo run --manifest-path=../cli/Cargo.toml -- install aws_security_group aws_elb aws_cloudwatch aws_ecr aws_ecs aws_rds --db=iasql --noninteractive

# Login. Review your profile
echo "\nDocker login..."
aws ecr get-login-password | docker login --username AWS --password-stdin ${REGISTRY_URI}

# Build
echo "\nBuilding image..."
docker build -t iasql-engine-repository .

# Tag
echo "\nTagging image..."
docker tag iasql-engine-repository:latest ${LATEST_IMAGE_URI}

# Push
echo "\nPushing image..."
docker push ${LATEST_IMAGE_URI}

# Prepare iasql-on-iasql.sql script
echo "\nPreparing iasql script..."
export $(cat .deploy-env | xargs) && sed "s/<DB_PASSWORD>/${DB_PASSWORD}/g;s/<AWS_ACCOUNT_ID>/${AWS_ACCOUNT_ID}/g;s/<IRONPLANS_TOKEN>/${IRONPLANS_TOKEN}/g" ./src/script/iasql-on-iasql.sql > ./src/script/iasql-on-iasql.out.sql

# Update service. Set PGPASSWORD environment variable to avoid interaction
echo "\nUpdating iasql db..."
psql -h localhost -p 5432 -U postgres -d iasql -f ./src/script/iasql-on-iasql.out.sql

# IaSQL db apply. Using local debug version
echo "\nApplying changes from iasql db..."
cargo run --manifest-path=../cli/Cargo.toml -- apply iasql --noninteractive

# Clean and leave just the last image
echo "\nCleaning docker images..."
if [ $(docker images -q ${IMAGE_URI} | wc -l) -gt 2 ]; then docker rmi $(docker images -q ${IMAGE_URI} | tail -n +2); fi