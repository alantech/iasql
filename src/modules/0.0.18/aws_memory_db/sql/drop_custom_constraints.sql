ALTER TABLE memory_db_cluster DROP CONSTRAINT check_memory_db_cluster_subnets;
DROP FUNCTION "check_memory_db_cluster_subnets";

DROP TRIGGER IF EXISTS check_subnets_by_memory_db_cluster ON subnet;
DROP FUNCTION "check_subnets_by_memory_db_cluster";
