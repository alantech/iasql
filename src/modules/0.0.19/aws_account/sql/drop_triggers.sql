DROP TRIGGER there_can_be_only_one_aws_default_region ON aws_regions;
DROP FUNCTION there_can_be_only_one_aws_default_region_trigger;

DROP FUNCTION default_aws_region(text);
DROP FUNCTION default_aws_region();