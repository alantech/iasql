 -- This check function implements the other half of a foreign key's behavior by raising an error on delete
-- or update of a subnet that is being referenced by a load balancer.
CREATE
OR REPLACE FUNCTION check_subnets_by_load_balancer () RETURNS TRIGGER AS $check_subnets_by_load_balancer$
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

CREATE TRIGGER
  check_subnets_by_load_balancer BEFORE DELETE
  OR
UPDATE
  ON subnet FOR EACH ROW
EXECUTE
  FUNCTION check_subnets_by_load_balancer ();
