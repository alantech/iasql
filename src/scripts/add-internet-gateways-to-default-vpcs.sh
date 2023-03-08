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

query "SELECT iasql_begin();"
query "SELECT ig.internet_gateway_id as ig_id, route.region, route.route_table_id
         from route
                  join route_table rt on rt.id = route.route_table_id
                  join vpc v on rt.vpc_id = v.id
                  join internet_gateway ig on v.id = ig.vpc_id
         where v.is_default
         group by route.route_table_id, route.region, ig.internet_gateway_id
         having ('0.0.0.0/0' <> ALL (array_agg(destination)));"
for row in $ret_val; do
  IFS='|' read -r ig_id region rt_id <<<"$row"
  query "INSERT INTO route (destination, gateway_id, region, route_table_id)
         VALUES ('0.0.0.0/0', '$ig_id', '$region', '$rt_id');"
done
query "SELECT iasql_commit();"
