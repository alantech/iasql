ALTER TABLE
  "parameter_group"
ADD
  CONSTRAINT "FK_param_grp_region" FOREIGN KEY ("region") REFERENCES "aws_regions" ("region") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE
  "rds"
ADD
  CONSTRAINT "FK_rds_region" FOREIGN KEY ("region") REFERENCES "aws_regions" ("region") ON DELETE NO ACTION ON UPDATE NO ACTION;
