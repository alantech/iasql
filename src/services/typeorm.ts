import { randomInt, } from 'crypto';
import {
  Connection,
  EntityTarget,
  createConnection,
  getConnectionManager,
  getMetadataArgsStorage,
} from 'typeorm';
import { PostgresConnectionOptions, } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { SnakeNamingStrategy, } from 'typeorm-naming-strategies'

import config from '../config';

export class TypeormWrapper {
  private connection: Connection
  private connectionConfig: PostgresConnectionOptions = {
    type: 'postgres',
    username: config.dbUser,
    password: config.dbPassword,
    host: config.dbHost,
    entities: [`${__dirname}/../entity/**/*.js`],
    namingStrategy: new SnakeNamingStrategy(), // TODO: Do we allow modules to change this?
    extra: { ssl: ['postgresql', 'localhost'].includes(config.dbHost) ? false : { rejectUnauthorized: false } },  // TODO: remove once DB instance with custom ssl cert is in place
  }

  static async createConn(database: string, connectionConfig: PostgresConnectionOptions): Promise<TypeormWrapper> {
    const typeorm = new TypeormWrapper();
    const connMan = getConnectionManager();
    const dbname = `database-${randomInt(200000)}`;
    if (connMan.has(dbname)) {
      throw new Error(`Connection ${dbname} already exists`)
    }
    const connOpts: PostgresConnectionOptions = {
      ...typeorm.connectionConfig,
      ...connectionConfig,
      name: dbname, // TODO improve connection name handling
      database,
    }
    typeorm.connection = await createConnection(connOpts);
    return typeorm;
  }

  async dropConn() {
    await this.connection.close();
  }

  async find(entity: EntityTarget<any>, options?: any): Promise<any> {
    return await this.connection.manager.getRepository(entity).find(options);
  }

  async findOne(entity: EntityTarget<any>, options?: any): Promise<any> {
    return await this.connection.manager.getRepository(entity).findOne(options);
  }

  async query(query: string): Promise<any> {
    return await this.connection.query(query);
  }

  async maybeAttachPrimaryColumn(entity: EntityTarget<any>, value: any) {
    // Grab the TypeORM metadata to determine the primary column of this entity and any join tables
    const ormMetadata = getMetadataArgsStorage();
    // Depth-first recursively add the primary column to nested entities, if they exist
    for (const relation of ormMetadata.relations) {
      if (relation.target !== entity) continue; // relations not involving this entity are ignored
      if ((typeof relation.type) === 'string') continue; // "basic" SQL types won't have an id
      if ((typeof relation.type) === 'function') {
        const otherEntity = (relation.type as Function)(); // Why did TS fail the typecheck here?
        const otherVal = value[relation.propertyName];
        if (!!otherEntity && !!otherVal) {
          await this.maybeAttachPrimaryColumn(otherEntity, otherVal);
        }
      }
    }
    // Now find the primary column of this entity (if one exists)
    const primaryColumn = ormMetadata
      .columns
      .filter(c => c.target === entity)
      .filter(c => c.options.primary)
      .map(c => c.propertyName)
      .shift();
    if (primaryColumn) {
      // Find all of the fields made up of basic types, if any
      const normalKVs = Object.fromEntries(
        Object.entries(value)
          .filter(([k, _v]) => k !== primaryColumn)
          .filter(([_k, v]) => !Array.isArray(v) && !(v instanceof Object))
      );
      // If there are any, then we can do a query for a potential exact match, and then associate
      // that match's ID
      if (Object.keys(normalKVs).length > 0) {
        const possibleMatch = await this.connection.manager.getRepository(entity).findOne({
          where: normalKVs,
        });
        if (possibleMatch) {
          value[primaryColumn] = possibleMatch[primaryColumn];
        }
      }
    }
  }

  async save(entity: EntityTarget<any>, value: any) {
    const repository = this.connection.manager.getRepository(entity);
    if (value) {
      if (Array.isArray(value)) {
        for (const val of value) {
          await this.maybeAttachPrimaryColumn(entity, val);
        }
      } else {
        await this.maybeAttachPrimaryColumn(entity, value);
      }
    }
    const batchSize = 100; // Determined through trial-and-error with a large, slow entity
    if (value && Array.isArray(value) && value.length > batchSize) {
      for (let i = 0; i < value.length; i += batchSize) {
        const batch = value.slice(i, i + batchSize);
        await repository.save(batch);
      }
    } else {
      await repository.save(value);
    }
  }

  async remove(entity: EntityTarget<any>, value: any) {
    const repository = this.connection.manager.getRepository(entity);
    await repository.remove(value);
  }

  createQueryRunner() {
    return this.connection.createQueryRunner();
  }
}
