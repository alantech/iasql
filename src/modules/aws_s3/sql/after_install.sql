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

CREATE
    OR REPLACE FUNCTION get_bucket_website_endpoint(bucket_name TEXT) RETURNS TEXT AS
$$
DECLARE
    _region text;
BEGIN
    SELECT region INTO _region FROM bucket WHERE name = bucket_name;
    IF bucket_name IN -- https://docs.aws.amazon.com/general/latest/gr/s3.html#s3_website_region_endpoints
       ('us-east-2', 'af-south-1', 'ap-east-1', 'ap-south-2', 'ap-southeast-3', 'ap-south-1', 'ap-northeast-3',
        'ap-northeast-2', 'ca-central-1', 'cn-northwest-1', 'eu-central-1', 'eu-west-2', 'eu-south-1', 'eu-west-3',
        'eu-north-1', 'eu-south-2', 'eu-central-2', 'me-south-1', 'me-central-1')
    THEN
        RETURN bucket_name || '.' ||  _region || '.amazonaws.com';
    ELSE
        RETURN bucket_name || '-' ||  _region || '.amazonaws.com';
    END IF;
END
$$ LANGUAGE plpgsql;
