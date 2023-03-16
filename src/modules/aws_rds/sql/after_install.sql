CREATE
OR REPLACE FUNCTION block_rds_in_cluster_pk_update () RETURNS TRIGGER AS $block_rds_in_cluster_pk_update$
    BEGIN
        RAISE EXCEPTION 'RDS primary key on an instance belonging to a multi-az cluster cannot be modified'
        USING detail = 'An RDS instance belonging to a multi-az cluster cannot be moved to another region or renamed', 
        hint = 'If you want to change an RDS belonging to a multi-az cluster, please modify cluster settings directly.';
        RETURN OLD;
    END;
$block_rds_in_cluster_pk_update$ LANGUAGE plpgsql;

CREATE TRIGGER
  block_rds_in_cluster_pk_update BEFORE
UPDATE
  ON rds FOR EACH ROW WHEN (
    OLD.region IS DISTINCT
    FROM
      NEW.region OR OLD.db_instance_identifier IS DISTINCT FROM NEW.db_instance_identifier)
      AND OLD.db_cluster_id IS NOT NULL
  )
EXECUTE
  FUNCTION block_rds_in_cluster_pk_update ();
