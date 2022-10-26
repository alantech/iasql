CREATE
OR REPLACE FUNCTION block_s3_primary_key_update () RETURNS TRIGGER AS $block_s3_primary_key_update$
    BEGIN
        RAISE EXCEPTION 'Bucket name or region cannot be modified'
        USING detail = 'A bucket cannot be renamed or moved to another region', 
        hint = 'If you want to rename or change bucket region, first remove it, and if re-using the same name then you must wait about 2 hours before creating again.';
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

CREATE
OR REPLACE FUNCTION block_s3_object_primary_key_update () RETURNS TRIGGER AS $block_s3_object_primary_key_update$
    BEGIN
        RAISE EXCEPTION 'Object bucket, key or region cannot be modified'
        USING detail = 'A bucket object cannot be renamed or moved to another region or bucket', 
        hint = 'If you want to rename or change bucket object, first remove it and then you could add it again.';
        RETURN OLD;
    END;
$block_s3_object_primary_key_update$ LANGUAGE plpgsql;

CREATE TRIGGER
  block_s3_object_primary_key_update BEFORE
UPDATE
  ON bucket_object FOR EACH ROW
  WHEN (
    OLD.bucket_name IS DISTINCT
    FROM
      NEW.bucket_name
      OR OLD.region IS DISTINCT
    FROM
      NEW.region
      OR OLD.key IS DISTINCT
    FROM
      NEW.key
  )
EXECUTE
  FUNCTION block_s3_object_primary_key_update ();
