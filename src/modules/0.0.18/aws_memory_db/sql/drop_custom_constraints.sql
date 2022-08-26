ALTER TABLE subnet_group DROP CONSTRAINT check_subnet_group_subnets;
DROP FUNCTION "check_subnet_group_subnets";

DROP TRIGGER IF EXISTS check_subnets_by_subnet_group ON subnet;
DROP FUNCTION "check_subnets_by_subnet_group";
