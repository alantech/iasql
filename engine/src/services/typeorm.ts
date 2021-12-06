import { randomInt, } from 'crypto';
import { Connection, createConnection, EntityTarget, getConnectionManager, } from 'typeorm';
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
    namingStrategy: new SnakeNamingStrategy(), // TODO: Do we allow modules to change this?
  }

  static async createConn(database: string, connectionConfig: PostgresConnectionOptions): Promise<TypeormWrapper> {
    const typeorm = new TypeormWrapper();
    const connMan = getConnectionManager();
    const dbname = `database-${randomInt(200000)}`;
    if (connMan.has(dbname)) {
      throw new Error(`Connection ${dbname} already exists`)
    }
    connectionConfig = connectionConfig ?? typeorm.connectionConfig;
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

  async save(entity: EntityTarget<any>, value: any) {
    const repository = this.connection.manager.getRepository(entity);
    const batchSize = 500;
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
