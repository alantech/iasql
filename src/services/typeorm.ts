import { randomInt, } from 'crypto';
import { Pool } from 'pg';
import { Connection, createConnection, EntityTarget, getConnectionManager, } from 'typeorm';
import { PostgresConnectionOptions, } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { PostgresDriver, } from 'typeorm/driver/postgres/PostgresDriver';
import { SnakeNamingStrategy, } from 'typeorm-naming-strategies'

import { v0_0_1 as Modules, } from '../modules'
import config from '../config';

// Grab all of the entities and create the TypeORM connection with it. Theoretically only need the
// module in question at first, but when we try to use the module to acquire the cloud records, it
// may use one or more other modules it depends on, so we just load them all into the TypeORM client
const entities = Object.values(Modules)
  .filter(m => m.hasOwnProperty('provides'))
  .map((m: any) => Object.values(m.provides.entities))
  .flat()
  .filter(e => typeof e === 'function') as Function[];

export class TypeormWrapper {
  private connection: Connection
  private connectionConfig: PostgresConnectionOptions = {
    type: 'postgres',
    username: config.db.user,
    password: config.db.password,
    host: config.db.host,
    entities,
    namingStrategy: new SnakeNamingStrategy(), // TODO: Do we allow modules to change this?
    extra: {
      ssl: ['postgresql', 'localhost'].includes(config.db.host) ? false : {
        rejectUnauthorized: false,
      }
    },  // TODO: remove once DB instance with custom ssl cert is in place
  }

  static async createConn(database: string, connectionConfig = {}): Promise<TypeormWrapper> {
    const typeorm = new TypeormWrapper();
    const connMan = getConnectionManager();
    const dbname = `database-${randomInt(200000)}`;
    if (connMan.has(dbname)) {
      throw new Error(`Connection ${dbname} already exists`)
    }
    const connOpts: PostgresConnectionOptions = {
      ...typeorm.connectionConfig,
      name: dbname,
      ...connectionConfig as PostgresConnectionOptions,
      database,
    }
    typeorm.connection = await createConnection(connOpts);
    return typeorm;
  }

  getMasterConnection(): Pool | undefined {
    if (this.connection.driver instanceof PostgresDriver) {
      return this.connection.driver.master as Pool;
    }
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

  async save(entity: EntityTarget<any>, value: any) {
    const repository = this.connection.manager.getRepository(entity);
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
