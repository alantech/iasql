-- Since Postgres does not allow arrays of foreign keys, but we prefer the syntactic simplicity they
-- provide. This check function implements half of a foreign key's behavior by making sure on insert
-- or update of a memory db cluster that all referenced subnets actually exist.
create or replace function check_memory_db_cluster_subnets(_subnets text[]) returns boolean
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
ALTER TABLE memory_db_cluster ADD CONSTRAINT check_memory_db_cluster_subnets CHECK (check_memory_db_cluster_subnets(subnets));

-- This check function implements the other half of a foreign key's behavior by raising an error on delete
-- or update of a subnet that is being referenced by a memodry db cluster.
CREATE OR REPLACE FUNCTION check_subnets_by_memory_db_cluster() RETURNS trigger AS $check_subnets_by_memory_db_cluster$
    DECLARE
        r record;
    BEGIN
        FOR r IN
            SELECT * FROM memory_db_cluster
        LOOP
            IF OLD.subnet_id = any(r.subnets) THEN
                RAISE EXCEPTION 'subnet_id % is being used by MemoryDB Cluster %', OLD.subnet_id, r.cluster_name;
            END IF;
        END LOOP;
        IF (TG_OP = 'DELETE') THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END;
$check_subnets_by_memory_db_cluster$ LANGUAGE plpgsql;

CREATE TRIGGER check_subnets_by_memory_db_cluster
BEFORE DELETE OR UPDATE ON subnet
FOR EACH ROW
EXECUTE FUNCTION check_subnets_by_memory_db_cluster();
