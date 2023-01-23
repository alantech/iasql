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
  IFS='|' read -r ig_id vpc_id <<< "$id"
  echo "Attaching internet gateway $ig_id to route table from vpc $vpc_id"
  query "SELECT id FROM route WHERE destination_cidr_block = '0.0.0.0/0' AND internet_gateway_id IS NOT NULL AND route_table_id = (SELECT id FROM route_table WHERE vpc_id = '$vpc_id' LIMIT 1);"
  if [ -z "$ret_val" ]
  then
    query "DELETE FROM route
            WHERE route_table_id = (select id from route_table where vpc_id = '$vpc_id') AND internet_gateway_id IS NULL AND destination_cidr_block = '0.0.0.0/0';"
    query "INSERT INTO route (route_table_id, internet_gateway_id, destination_cidr_block)
            VALUES ((SELECT id FROM route_table WHERE vpc_id = '$vpc_id'), '$ig_id', '0.0.0.0/0');"
  fi
done
query "SELECT iasql_commit();"
echo $ret_val
