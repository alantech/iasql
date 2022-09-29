ALTER TABLE
  "cache_cluster"
ADD
  CONSTRAINT "FK_cache_cluster_region" FOREIGN KEY ("region") REFERENCES "aws_regions" ("region") ON DELETE NO ACTION ON UPDATE NO ACTION;
