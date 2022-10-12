ALTER TABLE
  "memory_db_cluster_security_groups"
DROP
  CONSTRAINT "FK_memory_db_cluster_security_groups_region";

DROP TRIGGER
  IF EXISTS check_subnet_group_subnets ON subnet_group;

DROP FUNCTION
  "check_subnet_group_subnets";

DROP TRIGGER
  IF EXISTS check_subnets_by_subnet_group ON subnet;

DROP FUNCTION
  "check_subnets_by_subnet_group";
