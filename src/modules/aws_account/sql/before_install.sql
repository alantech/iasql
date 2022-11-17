CREATE
OR REPLACE FUNCTION default_aws_region () RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  r TEXT;
BEGIN
  SELECT region INTO r
  FROM aws_regions WHERE is_default = TRUE;
  SELECT CASE WHEN r is NULL THEN 'us-east-1' ELSE r END into r;
  RETURN r;
END
$$;
