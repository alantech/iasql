 -- Since Postgres does not allow arrays of foreign keys, but we prefer the syntactic simplicity they
-- provide. This check function implements half of a foreign key's behavior by making sure on insert
-- or update of a load balancer that all referenced availability zones actually exist. As AZs really
-- never change at all, this is considered an acceptable compromise.
CREATE
OR REPLACE FUNCTION check_load_balancer_availability_zones (_load_balancer_name VARCHAR, _availability_zones VARCHAR[]) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  _number_of_records integer;
begin
  select count(*) from availability_zone where name = any(_availability_zones) into _number_of_records;
  if _number_of_records != array_length(_availability_zones, 1) then
    raise exception 'Load balancer % includes one or more invalid availability zones', _load_balancer_name;
  end if;
  return true;
end;
$$;

-- Since Postgres does not allow arrays of foreign keys, but we prefer the syntactic simplicity they
-- provide. This check function implements half of a foreign key's behavior by making sure on insert
-- or update of a load balancer that all referenced subnets actually exist.
CREATE
OR REPLACE FUNCTION check_load_balancer_subnets (_subnets TEXT[]) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  _subnets_count integer;
begin
  select COUNT(*) into _subnets_count
  from subnet
  where subnet_id = any(_subnets);
  return _subnets_count = array_length(_subnets, 1);
end;
$$;
