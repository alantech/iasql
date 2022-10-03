ALTER TABLE
  "certificate_import"
ADD
  CONSTRAINT "FK_certificate_import_region" FOREIGN KEY ("region") REFERENCES "aws_regions" ("region") ON DELETE NO ACTION ON UPDATE NO ACTION;
