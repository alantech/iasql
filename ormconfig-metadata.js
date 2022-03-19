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
  "src/metadata/entity/**/*.ts"
 ],
 "migrationsTableName": "__migrations__",
 "migrations": [
  "src/metadata/migration/**/*.ts"
 ],
 "subscribers": [
  "src/metadata/subscriber/**/*.ts"
 ],
 "cli": {
  "entitiesDir": "src/metadata/entity",
  "migrationsDir": "src/metadata/migration",
  "subscribersDir": "src/metadata/subscriber"
 },
 namingStrategy: new SnakeNamingStrategy(),
};