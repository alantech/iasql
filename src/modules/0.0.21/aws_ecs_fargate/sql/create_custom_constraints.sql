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

CREATE OR REPLACE FUNCTION check_subnets_by_service() RETURNS trigger AS $check_subnets_by_service$
    DECLARE
        service_row record;
    BEGIN
        FOR service_row IN
            SELECT * FROM service
        LOOP
            IF OLD.subnet_id = any(service_row.subnets) THEN
                RAISE EXCEPTION 'subnet_id % is being used by service %', OLD.subnet_id, service_row.name;
            END IF;
        END LOOP;
        IF (TG_OP = 'DELETE') THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END;
$check_subnets_by_service$ LANGUAGE plpgsql;

-- TODO: Currently any subnet update means a replacement and this could get affected. Eventually update the 
-- trigger UPDATE OF property with the replacement fields
CREATE TRIGGER check_subnets_by_service
BEFORE DELETE OR UPDATE ON subnet
FOR EACH ROW
EXECUTE FUNCTION check_subnets_by_service();
