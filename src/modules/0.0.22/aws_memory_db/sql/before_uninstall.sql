DROP TRIGGER
  IF EXISTS check_subnets_by_subnet_group ON subnet;

DROP FUNCTION
  "check_subnets_by_subnet_group";

DROP TRIGGER
  IF EXISTS check_subnet_group_subnets ON subnet_group;

DROP FUNCTION
  "check_subnet_group_subnets";
