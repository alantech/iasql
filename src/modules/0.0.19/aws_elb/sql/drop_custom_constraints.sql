ALTER TABLE load_balancer DROP CONSTRAINT check_load_balancer_availability_zones;
DROP FUNCTION "check_load_balancer_availability_zones";

ALTER TABLE load_balancer DROP CONSTRAINT check_load_balancer_subnets;
DROP FUNCTION "check_load_balancer_subnets";

DROP TRIGGER IF EXISTS check_subnets_by_load_balancer ON subnet;
DROP FUNCTION "check_subnets_by_load_balancer";
