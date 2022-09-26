ALTER TABLE
  "secret"
ADD
  CONSTRAINT "FK_secret_region" FOREIGN KEY ("region") REFERENCES "aws_regions" ("region") ON DELETE NO ACTION ON UPDATE NO ACTION;
