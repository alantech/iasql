-- Since Postgres does not allow arrays of foreign keys, but we prefer the syntactic simplicity they
-- provide. This check function implements half of a foreign key's behavior by making sure on insert
-- or update of a load balancer that all referenced availability zones actually exist. As AZs really
-- never change at all, this is considered an acceptable compromise.
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

-- Since Postgres does not allow arrays of foreign keys, but we prefer the syntactic simplicity they
-- provide. This check function implements half of a foreign key's behavior by making sure on insert
-- or update of a load balancer that all referenced subnets actually exist.
create or replace function check_load_balancer_subnets(_subnets text[]) returns boolean
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
ALTER TABLE load_balancer ADD CONSTRAINT check_load_balancer_subnets CHECK (check_load_balancer_subnets(subnets));

-- This check function implements the other half of a foreign key's behavior by raising an error on delete
-- or update of a subnet that is being referenced by a load balancer.
CREATE OR REPLACE FUNCTION check_subnets_by_load_balancer() RETURNS trigger AS $check_subnets_by_load_balancer$
    DECLARE
        lb_row record;
    BEGIN
        FOR lb_row IN
            SELECT * FROM load_balancer
        LOOP
            IF OLD.subnet_id = any(lb_row.subnets) THEN
                RAISE EXCEPTION 'subnet_id % is being used by load balancer %', OLD.subnet_id, lb_row.load_balancer_name;
            END IF;
        END LOOP;
        IF (TG_OP = 'DELETE') THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END;
$check_subnets_by_load_balancer$ LANGUAGE plpgsql;

CREATE TRIGGER check_subnets_by_load_balancer
BEFORE DELETE OR UPDATE ON subnet
FOR EACH ROW
EXECUTE FUNCTION check_subnets_by_load_balancer();
