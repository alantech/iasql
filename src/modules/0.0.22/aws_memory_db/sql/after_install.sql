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

-- Since Postgres does not allow arrays of foreign keys, but we prefer the syntactic simplicity they
-- provide. This check function implements half of a foreign key's behavior by making sure on insert
-- or update of a memory db subnet group that all referenced subnets actually exist.
CREATE
OR REPLACE FUNCTION check_subnet_group_subnets () RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $check_subnet_group_subnets$
declare
  _subnets_count integer;
  _vpc_count integer;
begin
  select COUNT(*) into _subnets_count
  from subnet
  where subnet_id = any(NEW.subnets) AND region = NEW.region;

  select COUNT(distinct vpc_id) into _vpc_count
  from subnet
  where subnet_id = any(NEW.subnets) and region = NEW.region;

  IF ((_subnets_count = 0 OR _subnets_count = array_length(NEW.subnets, 1)) AND _vpc_count <= 1) THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Subnets must be from the same vpc and region.';
    RETURN OLD;
  END IF;
end;
$check_subnet_group_subnets$;

CREATE TRIGGER
  check_subnet_group_subnets BEFORE INSERT
  OR
UPDATE
  ON subnet_group FOR EACH ROW
EXECUTE
  FUNCTION check_subnet_group_subnets ();
