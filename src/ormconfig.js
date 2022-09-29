const { SnakeNamingStrategy } = require('typeorm-naming-strategies');

module.exports = {
 "type": "postgres",
 "host": "localhost",
 "port": 5432,
 "username": "postgres",
 "password": "test",
 "database": "__example__",
 "synchronize": true,
 "logging": false,
 "entities": [
  "modules/0.0.21/aws_ecs_fargate/entity/*.ts",
"modules/0.0.21/aws_account/entity/*.ts",
"modules/0.0.21/aws_ecr/entity/*.ts",
"modules/0.0.21/aws_elb/entity/*.ts",
"modules/0.0.21/aws_security_group/entity/*.ts",
"modules/0.0.21/aws_vpc/entity/*.ts",
"modules/0.0.21/aws_acm_list/entity/*.ts",
"modules/0.0.21/aws_cloudwatch/entity/*.ts",
"modules/0.0.21/aws_iam/entity/*.ts",

 ],
 "migrationsTableName": "__migrations__",
 "migrations": [
  "modules/0.0.21/aws_ecs_fargate/migration/*.ts",
"modules/0.0.21/aws_account/migration/*.ts",
"modules/0.0.21/aws_ecr/migration/*.ts",
"modules/0.0.21/aws_elb/migration/*.ts",
"modules/0.0.21/aws_security_group/migration/*.ts",
"modules/0.0.21/aws_vpc/migration/*.ts",
"modules/0.0.21/aws_acm_list/migration/*.ts",
"modules/0.0.21/aws_cloudwatch/migration/*.ts",
"modules/0.0.21/aws_iam/migration/*.ts",

 ],
 "cli": {
  "entitiesDir": "modules/0.0.21/aws_ecs_fargate/entity",
  "migrationsDir": "modules/0.0.21/aws_ecs_fargate/migration",
 },
 namingStrategy: new SnakeNamingStrategy(),
};
