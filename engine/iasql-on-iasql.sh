#!/bin/bash

curl localhost:8088/v1/iasql/setup/core
curl localhost:8088/v1/db/check/core
./buildAndPush.sh
