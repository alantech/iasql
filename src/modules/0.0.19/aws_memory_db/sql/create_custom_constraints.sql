-- Since Postgres does not allow arrays of foreign keys, but we prefer the syntactic simplicity they
-- provide. This check function implements half of a foreign key's behavior by making sure on insert
-- or update of a memory db subnet group that all referenced subnets actually exist.
create or replace function check_subnet_group_subnets(_subnets text[]) returns boolean
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
ALTER TABLE subnet_group ADD CONSTRAINT check_subnet_group_subnets CHECK (check_subnet_group_subnets(subnets));

-- This check function implements the other half of a foreign key's behavior by raising an error on delete
-- or update of a subnet that is being referenced by a memodry db subnet group.
CREATE OR REPLACE FUNCTION check_subnets_by_subnet_group() RETURNS trigger AS $check_subnets_by_subnet_group$
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

CREATE TRIGGER check_subnets_by_subnet_group
BEFORE DELETE OR UPDATE ON subnet
FOR EACH ROW
EXECUTE FUNCTION check_subnets_by_subnet_group();

create or replace function check_subnet_group_subnets_same_vpc(_subnets text[]) returns boolean
language plpgsql security definer
as $$
declare
  _vpc_count integer;
begin
  select COUNT(distinct vpc_id) into _vpc_count
  from subnet
  where subnet_id = any(_subnets);
  return _vpc_count < 2;
end;
$$;
ALTER TABLE subnet_group ADD CONSTRAINT check_subnet_group_subnets_same_vpc CHECK (check_subnet_group_subnets_same_vpc(subnets));
