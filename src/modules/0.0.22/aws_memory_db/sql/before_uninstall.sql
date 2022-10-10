DROP TRIGGER
  IF EXISTS check_subnets_by_subnet_group ON subnet;

DROP FUNCTION
  "check_subnets_by_subnet_group";

ALTER TABLE "memory_db_cluster_security_groups" DROP CONSTRAINT "check_memorydb_cluster_security_group_region"
