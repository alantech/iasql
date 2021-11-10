#!/bin/bash

curl localhost:8088/v1/iasql/setup/core
echo
curl localhost:8088/v1/db/check/core
echo
./build-and-push.sh
