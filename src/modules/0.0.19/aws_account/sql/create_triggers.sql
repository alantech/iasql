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

CREATE OR REPLACE FUNCTION aws_default_region_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  default_count INTEGER;
BEGIN
  SELECT count(*) INTO default_count FROM aws_regions WHERE is_default = TRUE;
  IF default_count > 0 AND NEW.is_default = TRUE THEN
    RAISE EXCEPTION 'Only one AWS region may be the default';
  ELSE
    RETURN NEW;
  END IF;
END
$$;

CREATE TRIGGER aws_default_region BEFORE INSERT OR UPDATE
ON aws_regions
FOR EACH ROW EXECUTE FUNCTION aws_default_region_trigger();