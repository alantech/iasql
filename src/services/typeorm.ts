import { randomInt } from 'crypto';
import { Connection, createConnection, EntityTarget, getConnectionManager } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies'


export class Typeorm {
  private connection: Connection
  private connectionConfig: PostgresConnectionOptions = {
    type: 'postgres',
    username: 'postgres',
    password: 'test',
    host: 'postgresql',
    entities: [`${__dirname}/../entity/**/*.js`],
    namingStrategy: new SnakeNamingStrategy(),
  }

  constructor() { }

  static async createConn(database: string): Promise<Typeorm> {
    const typeorm = new Typeorm();
    const connMan = getConnectionManager();
    if (connMan.has(database)) {
      throw `Connection ${database} already exists`
    }
    const connOpts: PostgresConnectionOptions = {
      ...typeorm.connectionConfig,
      name: `database-${randomInt(200000)}`, // TODO improve connection name handling
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
    const repository = await this.connection.manager.getRepository(entity);
    await repository.save(value);
  }
}
