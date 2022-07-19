-- Create service subnets constraint
create or replace function check_service_subnets(_subnets text[]) returns boolean
language plpgsql security definer
as $$
declare
  _subnets_count integer;
begin
  select COUNT(*) into _subnets_count
  from subnet
  where subnet_id = any(_subnets);
  return _subnets_count = array_length(_subnets, 1);
end;
$$;
ALTER TABLE service ADD CONSTRAINT check_service_subnets CHECK (check_service_subnets(subnets));
