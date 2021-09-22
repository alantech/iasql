import { Connection, createConnection, EntityTarget, Repository } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';


export class Typeorm {
  private connection: Connection
  private connectionConfig: PostgresConnectionOptions = {
    type: 'postgres',
    username: 'postgres',
    password: 'test',
    host: 'postgresql',
    entities: [`${__dirname}/../entity/**/*.js`],
  }

  constructor() { }

  static async createConn(database: string): Promise<Typeorm> {
    const typeorm = new Typeorm();
    const connOpts: PostgresConnectionOptions = {
      ...typeorm.connectionConfig,
      name: database,
      database,
    }
    typeorm.connection = await createConnection(connOpts);
    return typeorm;
  }
  
  async dropConn() {
    await this.connection.close();
  }

  async save(entity: EntityTarget<any>, value: any) {
    const repository = await this.connection.manager.getRepository(entity);
    await repository.save(value);
  }
}
