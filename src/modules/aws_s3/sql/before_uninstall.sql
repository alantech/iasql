DROP TRIGGER
  IF EXISTS block_s3_object_primary_key_update ON bucket_object;

DROP FUNCTION
  "block_s3_object_primary_key_update";

DROP TRIGGER
  IF EXISTS block_s3_primary_key_update ON bucket;

DROP FUNCTION
  "block_s3_primary_key_update";
