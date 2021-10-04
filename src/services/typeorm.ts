import { randomInt, } from 'crypto';
import { Connection, createConnection, EntityTarget, getConnectionManager, } from 'typeorm';
import { PostgresConnectionOptions, } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { SnakeNamingStrategy, } from 'typeorm-naming-strategies'


export class TypeormWrapper {
  private connection: Connection
  private connectionConfig: PostgresConnectionOptions = {
    type: 'postgres',
    username: 'postgres',
    password: 'test',
    host: 'postgresql',
    entities: [`${__dirname}/../entity/**/*.js`],
    namingStrategy: new SnakeNamingStrategy(),
  }

  static async createConn(database: string): Promise<TypeormWrapper> {
    const typeorm = new TypeormWrapper();
    const connMan = getConnectionManager();
    const dbname = `database-${randomInt(200000)}`;
    if (connMan.has(dbname)) {
      throw new Error(`Connection ${dbname} already exists`)
    }
    const connOpts: PostgresConnectionOptions = {
      ...typeorm.connectionConfig,
      name: dbname, // TODO improve connection name handling
      database,
    }
    typeorm.connection = await createConnection(connOpts);
    return typeorm;
  }

  async dropConn() {
    await this.connection.close();
  }

  async find(entity: EntityTarget<any>): Promise<any> {
    return await this.connection.manager.getRepository(entity).find();
  }

  async query(query: string): Promise<any> {
    return await this.connection.query(query);
  }

  async save(entity: EntityTarget<any>, value: any) {
    let repository = this.connection.manager.getRepository(entity);
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
}
