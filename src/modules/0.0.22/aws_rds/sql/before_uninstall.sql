ALTER TABLE
  "parameter_group"
DROP
  CONSTRAINT "FK_param_grp_region";

ALTER TABLE
  "rds"
DROP
  CONSTRAINT "FK_rds_region";
