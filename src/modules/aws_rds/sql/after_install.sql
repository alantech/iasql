CREATE
OR REPLACE FUNCTION block_rds_in_cluster_region_update () RETURNS TRIGGER AS $block_rds_in_cluster_region_update$
    BEGIN
        RAISE EXCEPTION 'RDS region on an instance belongin to a cluster cannot be modified'
        USING detail = 'An RDS instance cannot be moved to another region', 
        hint = 'If you want to change RDS region, first remove it and recreate with the desired name and region.';
        RETURN OLD;
    END;
$block_rds_in_cluster_region_update$ LANGUAGE plpgsql;

CREATE TRIGGER
  block_rds_in_cluster_region_update BEFORE
UPDATE
  ON rds FOR EACH ROW WHEN (
    OLD.region IS DISTINCT
    FROM
      NEW.region
      AND OLD.db_cluster_id IS NOT NULL
  )
EXECUTE
  FUNCTION block_rds_in_cluster_region_update ();
