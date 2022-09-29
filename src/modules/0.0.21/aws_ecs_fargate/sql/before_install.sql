 -- Create service subnets constraint
CREATE
OR REPLACE FUNCTION check_service_subnets (_subnets TEXT[]) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  _subnets_count integer;
begin
  select COUNT(*) into _subnets_count
  from subnet
  where subnet_id = any(_subnets);
  return _subnets_count = array_length(_subnets, 1);
end;
$$;
