const { SnakeNamingStrategy } = require('typeorm-naming-strategies');

module.exports = {
 "type": "postgres",
 "host": "localhost",
 "port": 5432,
 "username": "postgres",
 "password": "test",
 "database": "iasql_metadata",
 "synchronize": true,
 "logging": false,
 "entities": [
  "src/entity/**/*.ts"
 ],
 "migrationsTableName": "__migrations__",
 "migrations": [
  "src/migration/**/*.ts"
 ],
 "subscribers": [
  "src/subscriber/**/*.ts"
 ],
 "cli": {
  "entitiesDir": "src/entity",
  "migrationsDir": "src/migration",
  "subscribersDir": "src/subscriber"
 },
 namingStrategy: new SnakeNamingStrategy(),
};