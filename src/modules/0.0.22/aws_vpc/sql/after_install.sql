 -- This check function implements the other half of a foreign key's behavior by raising an error on delete
-- or update of a subnet that is being referenced by a memodry db subnet group.
CREATE
OR REPLACE FUNCTION check_route_table_ids_region_update () RETURNS TRIGGER AS $$
    DECLARE
        r record;
    BEGIN
        IF OLD.region != NEW.region AND NEW.route_table_ids IS NOT NULL THEN
          RAISE EXCEPTION 'route_table_ids cannot be transferred between AWS regions. Please NULL this column and try again';
        END IF;
        RETURN NEW;
    END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER
  check_route_table_ids_region_update BEFORE
UPDATE
  ON endpoint_gateway FOR EACH ROW
EXECUTE
  FUNCTION check_route_table_ids_region_update ();
