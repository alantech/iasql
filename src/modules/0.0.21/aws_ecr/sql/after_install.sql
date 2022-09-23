ALTER TABLE "repository_policy" ADD CONSTRAINT "FK_repository_policy_region" FOREIGN KEY ("region") REFERENCES "aws_regions"("region") ON DELETE NO ACTION ON UPDATE NO ACTION;
