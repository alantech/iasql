import { SnakeNamingStrategy } from 'typeorm-naming-strategies'

export default {
   "name": "default",
   "type": "postgres",
   "host": "postgresql",
   "port": 5432,
   "username": "postgres",
   "password": "test",
   "database": "typeorm",
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
}