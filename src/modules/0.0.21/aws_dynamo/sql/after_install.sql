ALTER TABLE
  "dynamo_table"
ADD
  CONSTRAINT "FK_dynamo_region" FOREIGN KEY ("region") REFERENCES "aws_regions" ("region") ON DELETE NO ACTION ON UPDATE NO ACTION;
