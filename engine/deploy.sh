## Prerequisites:
## - Engine running locally
## - Added a db called iasql using organization credentials
## - PGPASSWORD environment variable defined in .deploy-env
## - DB_PASSWORD environment variable defined in .deploy-env
## - IRONPLANS_TOKEN environment variable defined in .deploy-env
#!/bin/bash

# Fail on error
set -e

# Login. Review your profile
echo "\nDocker login..."
aws ecr get-login-password --region us-east-2 --profile iasql | docker login --username AWS --password-stdin 547931376551.dkr.ecr.us-east-2.amazonaws.com

# Build
echo "\nBuilding image..."
docker build -t iasql-engine-repository .

# Tag
echo "\nTagging image..."
docker tag iasql-engine-repository:latest 547931376551.dkr.ecr.us-east-2.amazonaws.com/iasql-engine-repository:latest

# Push
echo "\nPushing image..."
docker push 547931376551.dkr.ecr.us-east-2.amazonaws.com/iasql-engine-repository:latest

# Prepare iasql-on-iasql.sql script
echo "\nPreparing iasql script..."
export $(cat .deploy-env | xargs) && sed "s/<DB_PASSWORD>/${DB_PASSWORD}/g;s/<IRONPLANS_TOKEN>/${IRONPLANS_TOKEN}/g" ./src/script/iasql-on-iasql.sql > ./src/script/iasql-on-iasql.out.sql

# Update service. Set PGPASSWORD environment variable to avoid interaction
echo "\nUpdating iasql db..."
psql -h localhost -p 5432 -U postgres -d iasql -f ./src/script/iasql-on-iasql.out.sql

# IaSQL db apply. Using local debug version
echo "\nApplying changes from iasql db..."
cargo run --manifest-path=../cli/Cargo.toml -- db apply iasql

# Clean and leave just the last image
echo "\nCleaning docker images..."
docker rmi $(docker images -q 547931376551.dkr.ecr.us-east-2.amazonaws.com/iasql-engine-repository | tail -n +2)
