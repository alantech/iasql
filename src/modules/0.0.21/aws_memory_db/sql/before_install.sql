 -- Since Postgres does not allow arrays of foreign keys, but we prefer the syntactic simplicity they
-- provide. This check function implements half of a foreign key's behavior by making sure on insert
-- or update of a memory db subnet group that all referenced subnets actually exist.
CREATE
OR REPLACE FUNCTION check_subnet_group_subnets (_subnets TEXT[]) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  _subnets_count integer;
begin
  select COUNT(*) into _subnets_count
  from subnet
  where subnet_id = any(_subnets);
  return _subnets_count = array_length(_subnets, 1);
end;
$$;

CREATE
OR REPLACE FUNCTION check_subnet_group_subnets_same_vpc (_subnets TEXT[]) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  _vpc_count integer;
begin
  select COUNT(distinct vpc_id) into _vpc_count
  from subnet
  where subnet_id = any(_subnets);
  return _vpc_count < 2;
end;
$$;
