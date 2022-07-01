import * as iasql from '../../src/services/iasql'
import {
  getPrefix,
  runQuery,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
  runInstall,
  runUninstall
} from '../helpers'

const modules = ['aws_ebs'];
const prefix = getPrefix();
const dbAlias = 'ebstest';
const gp2VolumeName = `${prefix}gp2volume`;
const gp3VolumeName = `${prefix}gp3volume`;
const availabilityZoneB = `${process.env.AWS_REGION}b`;
const availabilityZoneC = `${process.env.AWS_REGION}c`;

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown(modules));

describe('AwsEbsModule Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_REGION}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the module', install(modules));

  it('adds new volumes', query(`
    BEGIN;
      INSERT INTO general_purpose_volume (volume_type, availability_zone, tags)
      VALUES ('gp2', '${availabilityZoneC}', '{"Name": "${gp2VolumeName}"}');

      INSERT INTO general_purpose_volume (volume_type, availability_zone, size, tags)
      VALUES ('gp3', '${availabilityZoneB}', 50, '{"Name": "${gp3VolumeName}"}');
    COMMIT;
  `));

  it('checks volume count', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('sync before apply', sync());

  it('checks volume count', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res.length).toBe(0)));
  
  it('adds new volumes', query(`
    BEGIN;
      INSERT INTO general_purpose_volume (volume_type, availability_zone, tags)
      VALUES ('gp2', '${availabilityZoneC}', '{"Name": "${gp2VolumeName}"}');

      INSERT INTO general_purpose_volume (volume_type, availability_zone, size, tags)
      VALUES ('gp3', '${availabilityZoneB}', 50, '{"Name": "${gp3VolumeName}"}');
    COMMIT;
  `));

  it('checks volume count', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('applies the change', apply());

  it('checks volume count', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('uninstalls the module', uninstall(modules));

  it('installs the module', install(modules));

  it('checks volume count', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('tries to update a volume field to be restored', query(`
    UPDATE general_purpose_volume SET state = 'creating' WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `));
  
  it('applies the change which will undo the change', apply());
  
  it('checks volume restored', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `, (res: any[]) => expect(res[0]['state']).toBe('available')));

  it('tries to update a volume size', query(`
    UPDATE general_purpose_volume SET size = 150 WHERE tags ->> 'Name' = '${gp3VolumeName}';
  `));

  it('applies the change', apply());

  it('checks volume update', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res[0]['size']).toBe(150)));

  it('tries to update a volume availability zone', query(`
    UPDATE general_purpose_volume SET availability_zone = '${availabilityZoneC}' WHERE tags ->> 'Name' = '${gp3VolumeName}';
  `));

  it('applies the change', apply());

  it('checks volume count', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('checks volume replace', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res[0]['availability_zone']).toBe(availabilityZoneC)));

  it('tries to update a volume availability zone', query(`
    UPDATE general_purpose_volume SET tags = '{"Name": "${gp2VolumeName}", "updated": true}' WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `));

  it('applies the change', apply());

  it('checks volume update', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `, (res: any[]) => expect(res[0]['tags']['updated']).toBe(true)));

  it('deletes the volumes', query(`
    DELETE FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `));

  it('applies the change', apply());

  it('check deletes the volumes', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
    `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('AwsEbsModule install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the modules', install(modules));

  it('uninstalls the module', uninstall(['aws_ebs']));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    'postgres',
    true).then(...finish(done)));

  it('uninstalls the module', uninstall(['aws_ebs']));

  it('installs the module', install(['aws_ebs']));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
