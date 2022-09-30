ALTER TABLE
  "repository_image"
ADD
  CONSTRAINT "FK_priv_repository_image_region" FOREIGN KEY ("private_repository_region") REFERENCES "aws_regions" ("region") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE
  "repository"
ADD
  CONSTRAINT "FK_repository_region" FOREIGN KEY ("region") REFERENCES "aws_regions" ("region") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE
  "repository_policy"
ADD
  CONSTRAINT "FK_repository_policy_region" FOREIGN KEY ("region") REFERENCES "aws_regions" ("region") ON DELETE NO ACTION ON UPDATE NO ACTION;
