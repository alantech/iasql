import * as iasql from '../../src/services/iasql'
import { runQuery, runApply, finish, execComposeUp, execComposeDown, } from '../helpers'

jest.setTimeout(240000);

beforeAll(execComposeUp);

afterAll(execComposeDown);

const dbAlias = 'ec2test';
// specific to us-west-2, varies per region
const region = 'us-west-2'
const amznAmiId = 'ami-06cffe063efe892ad';
const ubuntuAmiId = 'ami-0892d3c7ee96c0bf7';

const apply = runApply.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);

describe('EC2 Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.add(
    dbAlias,
    region,
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the ec2 module', (done) => void iasql.install(
    ['aws_ec2@0.0.1', 'aws_security_group@0.0.1'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('adds two ec2 instance', (done) => {
    // TODO get inserts without sp to work
    // INSERT INTO instance (ami, instance_type_id)
    // VALUES ('${ubuntuAmiId}', ${recordId}), ('${amznAmiId}', ${recordId});
    query(`
      CALL create_or_update_ec2_instance('i-1', '${ubuntuAmiId}', 't2.micro', array['default']);
      CALL create_or_update_ec2_instance('i-2', '${amznAmiId}', 't2.micro', array['default']);
    `)((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('applies the created instances', apply);

  it('check number of instances', query(`
    SELECT *
    FROM instance;
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('set both ec2 instances to the same ami', query(`
    CALL create_or_update_ec2_instance('i-1', '${amznAmiId}', 't2.micro', array['default']);
  `));

  it('applies the instances change', apply);

  it('check number of instances', query(`
    SELECT *
    FROM instance;
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('check instance ami update', query(`
    SELECT *
    FROM instance
    WHERE ami = '${ubuntuAmiId}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('uninstalls the ec2 module', (done) => void iasql.uninstall(
    ['aws_ec2@0.0.1', 'aws_security_group@0.0.1'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('installs the ec2 module', (done) => void iasql.install(
    ['aws_ec2@0.0.1', 'aws_security_group@0.0.1'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('check number of instances', query(`
    SELECT *
    FROM instance;
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('deletes both ec2 instances', query(`
    DELETE FROM instance;
  `));

  it('applies the instances deletion', apply);

  it('check number of instances', query(`
    SELECT *
    FROM instance;
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});
