import { execSync, } from 'child_process'

import { createConnection, EntityTarget, } from 'typeorm'
import { SnakeNamingStrategy, } from 'typeorm-naming-strategies'

import * as Entities from '../../src/entity'
import { TypeormWrapper, } from '../../src/services/typeorm'
import { migrate, } from '../../src/services/db-manager'

jest.setTimeout(30000);

beforeAll((done) => {(async () => { // Jest still sucks at async
  // Spin up the Postgres server and wait for it to start
  execSync('cd test && docker-compose up -d && sleep 5');
  // Create the test database
  const conn = await createConnection({
    name: 'startup',
    type: 'postgres',
    username: 'postgres',
    password: 'test',
    host: 'localhost',
    port: 5432,
    database: 'postgres',
  });
  await conn.query('CREATE DATABASE test');
  await conn.close();
  done();
})()});

afterAll((done) => {(async () => {
  // Destroy the test database
  const conn = await createConnection({
    name: 'shutdown',
    type: 'postgres',
    username: 'postgres',
    password: 'test',
    host: 'localhost',
    database: 'postgres',
  });
  await conn.query('DROP DATABASE test');
  await conn.close();
  // Finally turn off the postgres server
  execSync('cd test && docker-compose down');
  done();
})()});

describe('Basic DB testing', () => {
  it('should run the migrations correctly', (done) => {(async () => {
    const conn = await createConnection({
      name: 'test',
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'localhost',
      database: 'test',
    });

    // Migrate in the database
    await migrate(conn);

    // Check that it worked
    const tbls = await conn.query("select * from pg_catalog.pg_tables where schemaname = 'public'");
    expect(tbls.length).toBeGreaterThan(0);

    // Disconnect
    await conn.close();
    done();
  })()});

  it('should query with the entities correctly', (done) => {(async () => {
    let orm: TypeormWrapper | undefined
    try {
      orm = await TypeormWrapper.createConn('test', {
        name: 'startup',
        type: 'postgres',
        username: 'postgres',
        password: 'test',
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        entities: [`${__dirname}/../../src/entity/**/*.ts`],
        namingStrategy: new SnakeNamingStrategy(),
      });
      const finds = [];
      for (const e of Object.values(Entities)) {
        if (typeof e === 'function') {
          finds.push(orm.find(e as EntityTarget<any>));
        }
      };
      await Promise.all(finds);
    } catch (e) {
      expect(e).toBeUndefined();
    } finally {
      await orm?.dropConn();
    }
    done();
  })()});
});