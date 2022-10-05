ALTER TABLE
  "log_group"
ADD
  CONSTRAINT "FK_log_group_region" FOREIGN KEY ("region") REFERENCES "aws_regions" ("region") ON DELETE NO ACTION ON UPDATE NO ACTION;
