import { execSync, } from 'child_process'

import { createConnection, EntityTarget, } from 'typeorm'
import { SnakeNamingStrategy, } from 'typeorm-naming-strategies'

import * as Entities from '../src/entity'
import * as Mappers from '../src/mapper'
import { TypeormWrapper, } from '../src/services/typeorm'
import { migrate, } from '../src/services/db-manager'
import { ViciousMockery, } from '../src/services/vicious-mockery'
import { AWS, } from '../src/services/gateways/aws'
import { IndexedAWS, } from '../src/services/indexed-aws'

const mappers: Mappers.EntityMapper[] = Object.values(Mappers)
  .filter(m => m instanceof Mappers.EntityMapper) as Mappers.EntityMapper[];

jest.setTimeout(30000);

beforeAll((done) => {(async () => { // Jest still sucks at async
  // Spin up the Postgres server and wait for it to start
  execSync('cd test && docker-compose up -d && sleep 5');
  // Create the test database
  let conn = await createConnection({
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

  conn = await createConnection({
    name: 'test',
    type: 'postgres',
    username: 'postgres',
    password: 'test',
    host: 'localhost',
    database: 'test',
  });

  // Migrate in the database
  await migrate(conn);
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

describe('DB-AWS Identity Property', () => {
  it('should load AWS data into an Entity, store into the DB, and load the same Entity back', (done) => {(async () => {
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
        entities: [`${__dirname}/../src/entity/**/*.ts`],
        namingStrategy: new SnakeNamingStrategy(),
      });
      const fakeAwsClient = ViciousMockery(`${__dirname}/db-aws-identity-property-mocks`) as AWS;
      // TODO: Make this work for more than just SecurityGroup
      const indexes = new IndexedAWS();
      await Mappers.SecurityGroupMapper.readAWS(fakeAwsClient, indexes);
      const awsRecord = Object.values(indexes.get(Entities.SecurityGroup))[0];
      const awsEntity = await Mappers.SecurityGroupMapper.fromAWS(awsRecord, fakeAwsClient, indexes);
      await orm.save(Entities.SecurityGroup, awsEntity);
      const dbEntity = (await orm.find(Entities.SecurityGroup))[0];
      expect(Object.keys(awsEntity).sort()).toEqual(Object.keys(dbEntity).sort());
    } catch(e) {
      expect(e).toBeUndefined();
    } finally {
      await orm?.dropConn();
    }
    done();
  })()});
});