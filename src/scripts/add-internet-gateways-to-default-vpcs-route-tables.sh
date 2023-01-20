#!/usr/bin/env bash
function query() {
  ret_val=$(psql postgres://$username:$password@localhost:5432/iasql -AXqtc "$1")
}

query "SELECT iasql_install('aws_vpc');"

query "SELECT ig.id, vpc.id
       FROM internet_gateway ig
          INNER JOIN vpc on vpc.id = ig.vpc_id
       WHERE vpc.is_default = true;"
ids=$ret_val

query "SELECT iasql_begin();"
for id in $ids; do
  IFS='|' read -ra splitarr <<< "$id"
  ig_id=${splitarr[0]}
  vpc_id=${splitarr[1]}
  echo "Attaching internet gateway $ig_id to route table from vpc $vpc_id"
  query "SELECT id FROM route WHERE destination_cidr_block = '0.0.0.0/0' AND internet_gateway_id IS NOT NULL AND route_table_id = (SELECT id FROM route_table WHERE vpc_id = '$vpc_id');"
  if [ -z "$ret_val" ]
  then
    query "INSERT INTO route (route_table_id, internet_gateway_id, destination_cidr_block)
            VALUES ((SELECT id FROM route_table WHERE vpc_id = '$vpc_id'), '$ig_id', '0.0.0.0/0');"
  fi
done
echo query "SELECT iasql_commit();"
