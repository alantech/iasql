ALTER TABLE
  "graphql_api"
ADD
  CONSTRAINT "FK_graphql_api_region" FOREIGN KEY ("region") REFERENCES "aws_regions" ("region") ON DELETE NO ACTION ON UPDATE NO ACTION;
