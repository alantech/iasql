ALTER TABLE service DROP CONSTRAINT check_service_subnets;
DROP FUNCTION "check_service_subnets";

DROP TRIGGER IF EXISTS check_subnets_by_service ON subnet;
DROP FUNCTION "check_subnets_by_service";
