#!/usr/bin/env bash
function query() {
  ret_val=$(psql postgres://$username:$password@localhost:5432/iasql -AXqtc "$1")
}

query "SELECT iasql_install('aws_vpc');"

query "SELECT vpc_id
       FROM vpc"
echo $ret_val
