create or replace function check_load_balancer_availability_zones(_load_balancer_name varchar, _availability_zones varchar[]) returns boolean
language plpgsql security definer
as $$
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
ALTER TABLE load_balancer ADD CONSTRAINT check_load_balancer_availability_zones CHECK (check_load_balancer_availability_zones(load_balancer_name, availability_zones));
