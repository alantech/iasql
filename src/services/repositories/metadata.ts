import { createConnection, Connection, Repository } from 'typeorm'
import { SnakeNamingStrategy, } from 'typeorm-naming-strategies'

import { IasqlDatabase, IasqlUser } from '../../metadata/entity/index';
import * as dbMan from '../db-manager'

class MetadataRepo {
  private database = 'iasql_metadata';
  private conn: Connection;
  private userRepo: Repository<IasqlUser>;
  private dbRepo: Repository<IasqlDatabase>;

  async init() {
    const conn = await createConnection(dbMan.baseConnConfig);
    try {
      await conn.query(`CREATE DATABASE ${this.database};`);
    } catch(e) {
      // CREATE DATABASE cannot be executed from a function and
      // postgres doesn't support IF NOT EXISTS for db creation so just ignore the error
    } finally {
      await conn.close();
    }
    this.conn = await createConnection({
      ...dbMan.baseConnConfig,
      name: this.database,
      namingStrategy: new SnakeNamingStrategy(),
      database: this.database,
      entities: [IasqlDatabase, IasqlUser],
      migrations: [`${__dirname}/../../metadata/migration/*.js`, `${__dirname}/../../metadata/migration/*.ts`],
      migrationsTableName: '__migrations__',
    });
    await this.conn.runMigrations();
    this.userRepo = this.conn.getRepository(IasqlUser);
    this.dbRepo = this.conn.getRepository(IasqlDatabase);
  }

  async saveDb(a0Id: string, email: string, dbAlias: string, dbId: string, dbUser: string, region: string): Promise<IasqlDatabase> {
    const db = new IasqlDatabase();
    db.alias = dbAlias;
    db.pgName = dbId;
    db.pgUser = dbUser;
    db.region = region;
    let user = await this.userRepo.findOne(a0Id);
    if (!user) {
      user = new IasqlUser();
      user.id = a0Id;
      user.email = email;
      user.iasqlDatabases = [db];
    } else {
      // check alias is unique for existing user
      if (user.iasqlDatabases.some(d => d.alias === dbAlias)) {
        throw new Error(`User with ID ${a0Id} already has an IaSQL database with alias ${dbAlias}`)
      }
      user.iasqlDatabases.push(db);
    }
    // save the db first
    await this.dbRepo.save(db);
    await this.userRepo.save(user);
    return db;
  }

  async getDb(a0Id: string, dbAlias: string): Promise<IasqlDatabase> {
    const user = await this.userRepo.findOneOrFail(a0Id);
    const db = user.iasqlDatabases.find(d => d.alias === dbAlias);
    if (!db) throw new Error(`User with ID ${a0Id} has no IaSQL database with alias ${dbAlias}`);
    return db;
  }

  async getDbs(a0Id: string): Promise<IasqlDatabase[]> {
    const user = await this.userRepo.findOne(a0Id);
    if (!user) return [];
    return user.iasqlDatabases;
  }

  async delDb(a0Id: string, dbAlias: string) {
    const user = await this.userRepo.findOneOrFail(a0Id);
    const dbToDel = user.iasqlDatabases.find(db => db.alias === dbAlias);
    if (!dbToDel) throw new Error(`User with ID ${a0Id} has no IaSQL database with alias ${dbAlias}`);
    user.iasqlDatabases = user.iasqlDatabases.filter(db => db.alias !== dbAlias);
    // remove entry from the join table
    await this.userRepo.save(user);
    // remove entry
    await this.dbRepo.delete(dbToDel);
  }
}
const singleton = new MetadataRepo();
export default singleton;