CREATE
OR REPLACE FUNCTION block_s3_primary_key_update () RETURNS TRIGGER AS $block_s3_primary_key_update$
    BEGIN
        RAISE EXCEPTION 'Bucket name or region cannot be modified'
        USING detail = 'A bucket cannot be renamed or moved to another region', 
        hint = 'If you want to rename or change bucket region, first remove it, and after a period of 2 hours you could re-create.';
        RETURN OLD;
    END;
$block_s3_primary_key_update$ LANGUAGE plpgsql;

CREATE TRIGGER
  block_s3_primary_key_update BEFORE
UPDATE
  ON bucket FOR EACH ROW
  WHEN (
    OLD.name IS DISTINCT
    FROM
      NEW.name
      OR OLD.region IS DISTINCT
    FROM
      NEW.region
  )
EXECUTE
  FUNCTION block_s3_primary_key_update ();
