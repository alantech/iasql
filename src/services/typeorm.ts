import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import { Connection, createConnection, EntityTarget, getConnectionManager } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { modules as AllModules } from '../modules';
import config from '../config';
import { NullCheckerSubscriber } from '../modules/subscribers';

export class TypeormWrapper {
  private connection: Connection;
  private connectionConfig: PostgresConnectionOptions = {
    type: 'postgres',
    username: config.db.user,
    password: config.db.password,
    host: config.db.host,
    namingStrategy: new SnakeNamingStrategy(), // TODO: Do we allow modules to change this?
    extra: {
      ssl: ['postgresql', 'localhost'].includes(config.db.host)
        ? false
        : {
            rejectUnauthorized: false,
          },
    }, // TODO: remove once DB instance with custom ssl cert is in place
  };

  static async getVersionString(database: string) {
    // Pulled this out as a function so it can be re-used in the iasql service. This should probably
    // be moved into Metadata at some point in the future, but for now let's assume that the
    // `iasql_module` table is stable
    const connMan = getConnectionManager();
    const dbname = uuidv4();
    if (connMan.has(dbname)) {
      throw new Error(`Connection ${dbname} already exists`);
    }
    const typeorm = new TypeormWrapper();
    const connOpts: PostgresConnectionOptions = {
      ...typeorm.connectionConfig,
      name: dbname,
      database,
    };
    const tempconn = await createConnection(connOpts);
    // If this connection is being used to create a new DB, assume we're creating one with the
    // newest module versions
    let versionString: string = config.modules.latestVersion;
    try {
      const res = await tempconn.query(`
        SELECT DISTINCT name FROM iasql_module LIMIT 1;
      `);
      versionString = res[0].name.split('@')[1];
    } catch (e) {
      // We're fine with just defaulting to the latest version
    }
    await tempconn.close();
    return versionString;
  }

  static async createConn(database: string, connectionConfig = {}): Promise<TypeormWrapper> {
    // First step: we need to probe the database to see what version it is.
    const typeorm = new TypeormWrapper();
    const connMan = getConnectionManager();
    const dbname = uuidv4();
    if (connMan.has(dbname)) {
      throw new Error(`Connection ${dbname} already exists`);
    }
    const versionString = await TypeormWrapper.getVersionString(database);
    const Modules = (AllModules as any)[versionString];
    if (!Modules) throw new Error(`Unsupported version ${versionString} in database ${database}`);
    // Grab all of the entities and create the TypeORM connection with it. Theoretically only need
    // the module in question at first, but when we try to use the module to acquire the cloud
    // records, it may use one or more other modules it depends on, so we just load them all into
    // the TypeORM client
    const entities = Object.values(Modules)
      .filter((m: any) => m.hasOwnProperty('provides'))
      .map((m: any) => Object.values(m.provides.entities))
      .flat()
      .filter(e => typeof e === 'function') as Function[];

    // Now that we have the entities for this database, close the temporary connection and create
    // the real connection with the entities present
    const name = uuidv4();
    const connOpts: PostgresConnectionOptions = {
      ...typeorm.connectionConfig,
      name: dbname,
      subscribers: [NullCheckerSubscriber],
      ...(connectionConfig as PostgresConnectionOptions),
      database,
    };

    typeorm.connection = await createConnection({ ...connOpts, entities, name });
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
    this.updateNulls(value);
  }

  async remove(entity: EntityTarget<any>, value: any) {
    const repository = this.connection.manager.getRepository(entity);
    await repository.remove(value);
  }

  createQueryRunner() {
    return this.connection.createQueryRunner();
  }

  updateNulls(value: any): void {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const v of value) {
        Object.keys(v ?? {}).forEach((k: string) => {
          if (v[k] === null) v[k] = undefined;
        });
      }
    } else if (Object.keys(value).length) {
      Object.keys(value).forEach((k: string) => {
        if (value[k] === null) value[k] = undefined;
      });
    }
  }
}
