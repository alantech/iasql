#!/bin/bash

aws ecr get-login-password --region eu-west-1 --profile alantech | docker login --username AWS --password-stdin 257682470237.dkr.ecr.eu-west-1.amazonaws.com/iasql-engine-repository
docker build -t 257682470237.dkr.ecr.eu-west-1.amazonaws.com/iasql-engine-repository:latest .
docker push 257682470237.dkr.ecr.eu-west-1.amazonaws.com/iasql-engine-repository:latest