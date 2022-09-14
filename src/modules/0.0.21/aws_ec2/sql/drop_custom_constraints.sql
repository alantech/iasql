ALTER TABLE registered_instance DROP CONSTRAINT check_target_group_instance;
DROP FUNCTION "check_target_group_instance";

ALTER TABLE instance DROP CONSTRAINT check_role_ec2;
DROP FUNCTION "check_role_ec2";
DROP INDEX role_policy_document_gin_idx;

ALTER TABLE general_purpose_volume DROP CONSTRAINT check_instance_ebs_availability_zone;
DROP FUNCTION "check_instance_ebs_availability_zone";
