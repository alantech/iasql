## Prerequisites:
## - Engine running locally
## - Added a db called iasql using organization credentials
## - PGPASSWORD environment variable defined
## - DB_PASSWORD environment variable defined
## - IRONPLANS_TOKEN environment variable defined
#!/bin/bash

# Fail on error
set -e

# Login. Review your profile
echo "Docker login..."
aws ecr get-login-password --region us-east-2 --profile iasql | docker login --username AWS --password-stdin 547931376551.dkr.ecr.us-east-2.amazonaws.com

# Build
echo "Building image..."
docker build -t iasql-engine-repository .

# Tag
echo "Tagging image..."
docker tag iasql-engine-repository:latest 547931376551.dkr.ecr.us-east-2.amazonaws.com/iasql-engine-repository:latest

# Push
echo "Pushing image..."
docker push 547931376551.dkr.ecr.us-east-2.amazonaws.com/iasql-engine-repository:latest

# Prepare iasql-on-iasql.sql script
echo "Preparing iasql script..."
sed "s/<DB_PASSWORD>/${DB_PASSWORD}/g;s/<IRONPLANS_TOKEN>/${IRONPLANS_TOKEN}/g" iasql-on-iasql.sql > iasql-on-iasql.out.sql

# Update service. Set PGPASSWORD environment variable to avoid interaction
echo "Updating iasql db..."
psql -h localhost -p 5432 -U postgres -d iasql -f ./src/script/iasql-on-iasql.out.sql

# IaSQL db apply
echo "Applying changes from iasql db..."
cargo run --manifest-path=../cli/Cargo.toml -- db apply iasql
