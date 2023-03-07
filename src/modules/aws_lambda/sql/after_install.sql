-- This check function implements the other half of a foreign key's behavior by raising an error on delete
-- or update of a subnet that is being referenced by a lambda.
CREATE
OR REPLACE FUNCTION check_subnets_by_lambda () RETURNS TRIGGER AS $check_subnets_by_lambda$
    DECLARE
        lb_row record;
    BEGIN
        FOR lb_row IN
            SELECT * FROM lambda_function
        LOOP
            IF OLD.subnet_id = any(lb_row.subnets) THEN
                RAISE EXCEPTION 'subnet_id % is being used by lambda %', OLD.subnet_id, lb_row.name;
            END IF;
        END LOOP;
        IF (TG_OP = 'DELETE') THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END;
$check_subnets_by_lambda$ LANGUAGE plpgsql;

CREATE TRIGGER
  check_subnets_by_lambda BEFORE DELETE
  OR
UPDATE
  ON subnet FOR EACH ROW
EXECUTE
  FUNCTION check_subnets_by_lambda ();
