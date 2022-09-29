CREATE
OR REPLACE FUNCTION check_subnets_by_service () RETURNS TRIGGER AS $check_subnets_by_service$
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
CREATE TRIGGER
  check_subnets_by_service BEFORE DELETE
  OR
UPDATE
  ON subnet FOR EACH ROW
EXECUTE
  FUNCTION check_subnets_by_service ();
