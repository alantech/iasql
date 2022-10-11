 -- This check function implements the other half of a foreign key's behavior by raising an error on delete
-- or update of a subnet that is being referenced by a memodry db subnet group.
CREATE
OR REPLACE FUNCTION check_subnets_by_subnet_group () RETURNS TRIGGER AS $check_subnets_by_subnet_group$
    DECLARE
        r record;
    BEGIN
        FOR r IN
            SELECT * FROM subnet_group
        LOOP
            IF OLD.subnet_id = any(r.subnets) THEN
                RAISE EXCEPTION 'subnet_id % is being used by MemoryDB Subnet Group %', OLD.subnet_id, r.cluster_name;
            END IF;
        END LOOP;
        IF (TG_OP = 'DELETE') THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END;
$check_subnets_by_subnet_group$ LANGUAGE plpgsql;

CREATE TRIGGER
  check_subnets_by_subnet_group BEFORE DELETE
  OR
UPDATE
  ON subnet FOR EACH ROW
EXECUTE
  FUNCTION check_subnets_by_subnet_group ();

-- ALTER TABLE
--   "memory_db_cluster_security_groups"
-- ADD
--   CONSTRAINT "check_memorydb_cluster_security_group_region" CHECK (security_group_region = memory_db_cluster_region)
