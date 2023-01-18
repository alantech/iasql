#!/usr/bin/env bash
function query() {
  ret_val=$(psql postgres://$username:$password@localhost:5432/iasql -AXqtc "$1")
}

query "SELECT iasql_install('aws_vpc');"

query "SELECT vpc.id
       FROM vpc
          LEFT JOIN internet_gateway ig on vpc.id = ig.vpc_id
       WHERE vpc.is_default = true
       GROUP BY vpc.id HAVING COUNT(ig) = 0;"
vpc_ids=$ret_val

query "SELECT iasql_begin();"
for vpc_id in $vpc_ids; do
  echo "$vpc_id is default but doesn't have an internet gateway. Let's fix it."
  query "INSERT INTO internet_gateway (region, vpc_id)
         VALUES ((SELECT region FROM vpc WHERE id = '$vpc_id'), '$vpc_id');"
done
query "SELECT iasql_commit();"
