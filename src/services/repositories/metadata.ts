import { createConnection, Connection, Repository } from 'typeorm'
import { SnakeNamingStrategy, } from 'typeorm-naming-strategies'

import { IasqlDatabase, IasqlUser } from '../../entity/index'
import * as dbMan from '../db-manager'
import logger from '../logger'
import * as telemetry from '../telemetry'

class MetadataRepo {
  private database = 'iasql_metadata';
  private conn: Connection;
  private userRepo: Repository<IasqlUser>;
  private dbRepo: Repository<IasqlDatabase>;

  initialized: boolean;

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
      migrations: [`${__dirname}/../../migration/*.js`, `${__dirname}/../../migration/*.ts`],
      migrationsTableName: '__migrations__',
    });
    await this.conn.runMigrations();
    this.userRepo = this.conn.getRepository(IasqlUser);
    this.dbRepo = this.conn.getRepository(IasqlDatabase);
    this.initialized = true;
  }

  async saveDb(a0Id: string, email: string, db: IasqlDatabase): Promise<IasqlDatabase> {
    let user = await this.userRepo.findOne(a0Id);
    if (!user) {
      user = new IasqlUser();
      user.id = a0Id;
      user.email = email;
      user.iasqlDatabases = [db];
    } else {
      // check alias is unique for existing user
      if (user.iasqlDatabases.some(d => d.alias === db.alias)) {
        throw new Error(`User with ID ${a0Id} already has an IaSQL database with alias ${db.alias}`)
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

  async updateDbCounts(dbId: string, recCount: number, opCount: number) {
    const db = await this.dbRepo.findOne(dbId);
    if (!db) {
      logger.warn(`No db with id ${dbId} found`);
      return;
    };
    db.recordCount = recCount;
    db.operationCount = opCount;
    await this.dbRepo.save(db);
  }

  async getUserFromDbId(dbId: string): Promise<IasqlUser | undefined> {
    const db = await this.dbRepo.findOne(dbId, {
      relations: ['iasqlUsers']
    });
    if (!db) {
      logger.warn(`No db with id ${dbId} found`);
      return;
    };
    // TODO change when dbs have more than one user
    return db.iasqlUsers[0];
  }

  async getDbs(a0Id: string, email: string): Promise<IasqlDatabase[]> {
    const user = await this.userRepo.findOne(a0Id);
    if (!user) {
      // create the new user
      const newUser = new IasqlUser();
      newUser.id = a0Id;
      newUser.email = email;
      newUser.iasqlDatabases = [];
      await this.userRepo.save(newUser);
      return [];
    };
    return user.iasqlDatabases;
  }

  async getAllDbs(): Promise<IasqlDatabase[]> {
    return this.dbRepo.find();
  }

  async delDb(a0Id: string, dbAlias: string) {
    const user = await this.userRepo.findOneOrFail(a0Id);
    const dbToDel = user.iasqlDatabases.find(db => db.alias === dbAlias);
    if (!dbToDel) throw new Error(`User with ID ${a0Id} has no IaSQL database with alias ${dbAlias}`);
    user.iasqlDatabases = user.iasqlDatabases.filter(db => db.alias !== dbAlias);
    // remove entry from the join table
    await this.userRepo.save(user);
    // remove entry
    await this.dbRepo.remove(dbToDel);
  }
}
const singleton = new MetadataRepo();
export default singleton;
