CREATE OR REPLACE FUNCTION default_aws_region()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  r TEXT;
BEGIN
  SELECT CASE WHEN region is NULL THEN 'us_east_1' ELSE region END INTO r
  FROM aws_regions WHERE is_default = TRUE;
  RETURN r;
END
$$;

CREATE OR REPLACE FUNCTION default_aws_region(r text)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  UPDATE aws_regions SET is_default = FALSE WHERE is_default = TRUE;
  UPDATE aws_regions SET is_default = TRUE where region = r;
  RETURN r;
END
$$;

CREATE OR REPLACE FUNCTION there_can_be_only_one_aws_default_region_trigger()
RETURNS trigger AS $$
DECLARE
  default_count INTEGER;
BEGIN
  SELECT count(*) INTO default_count FROM aws_regions WHERE is_default = TRUE;
  IF default_count > 0 && NEW.is_default = TRUE THEN
    RAISE EXCEPTION 'there can be only one';
  ELSE
    RETURN trigger;
  END;
END
$$;

CREATE CONSTRAINT TRIGGER there_can_be_only_one_aws_default_region
BEFORE INSERT OR UPDATE INITIALLY DEFERRED ON aws_regions
FOR EACH ROW EXECUTE there_can_be_only_one_aws_default_region_trigger();