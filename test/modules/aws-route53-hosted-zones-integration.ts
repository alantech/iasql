import config from '../../src/config';
import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runInstall, runUninstall, runApply, finish, execComposeUp, execComposeDown, runSync, } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'route53test';
const domainName = `${dbAlias}${prefix}.com.`;
const replaceDomainName = `${dbAlias}${prefix}replace.com.`;
const resourceRecordSetName = `test`;
const resourceRecordSetMultilineName = `test.multiline`;
const resourceRecordSetMultilineNameReplace = 'replace.test.multiline';
const resourceRecordSetTypeCNAME = 'CNAME';
const resourceRecordSetTypeA = 'A';
const resourceRecordSetTtl = 300;
const resourceRecordSetRecord = 'example.com.';
const resourceRecordSetRecordMultiline = `192.168.0.1
192.168.0.2`;
const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const modules = ['aws_route53_hosted_zones'];

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown(modules));

// TODO: test more record types
describe('Route53 Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    process.env.AWS_REGION ?? 'barf',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs module', install(modules));

  it('adds a new hosted zone', query(`
    INSERT INTO hosted_zone (domain_name)
    VALUES ('${domainName}');
  `));

  it('check adds a new hosted zone', query(`
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('undo changes', sync());

  it('check undo adds a new hosted zone', query(`
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('adds a new hosted zone', query(`
    INSERT INTO hosted_zone (domain_name)
    VALUES ('${domainName}');
  `));

  it('check adds a new hosted zone', query(`
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the hosted zone change', apply());

  it('check adds a new hosted zone', query(`
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check default record sets have been added', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('uninstalls the route53 module', uninstall(modules));

  it('installs the route53 module again (to make sure it reloads stuff)', install(modules));

  it('check adds a new hosted zone', query(`
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check default record sets have been added', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('adds a new record to hosted zone', query(`
    INSERT INTO resource_record_set (name, record_type, records, ttl, parent_hosted_zone_id)
    SELECT '${resourceRecordSetName}', '${resourceRecordSetTypeCNAME}', '${resourceRecordSetRecord}', ${resourceRecordSetTtl}, id
    FROM hosted_zone
    WHERE domain_name = '${domainName}';
  `));

  it('check default record sets have been added', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(3)));

  it('applies new resource record set', apply());

  it('check default record sets have been added', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(3)));

  it('tries to update a hosted zone domain name field (replace)', query(`
    UPDATE hosted_zone SET domain_name = '${replaceDomainName}' WHERE domain_name = '${domainName}';
  `));

  it('applies hosted zone replacement', apply());
  
  it('check replaced hosted zone', query(`
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check record sets have been keeped', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => expect(res.length).toBe(3)));

  it('check previous record sets have been removed', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('adds a new record to hosted zone', query(`
    INSERT INTO resource_record_set (name, record_type, records, ttl, parent_hosted_zone_id)
    SELECT '${resourceRecordSetMultilineName}', '${resourceRecordSetTypeA}', '${resourceRecordSetRecordMultiline}', ${resourceRecordSetTtl}, id
    FROM hosted_zone
    WHERE domain_name = '${replaceDomainName}';
  `));

  it('check record sets have been added', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => expect(res.length).toBe(4)));

  it('applies new multiline resource record set', apply());

  it('check multiline record set have been added', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => {
    console.log(`${JSON.stringify(res)}`)
    const multiline = res.find(r => {console.log(JSON.stringify(r)); return r.name === resourceRecordSetMultilineName && r.record_type === resourceRecordSetTypeA});
    expect(multiline).toBeDefined();  
    expect(multiline?.records?.split('\n').length).toBe(2);  
    return expect(res.length).toBe(4);
  }));

  it('updates a record name', query(`
    UPDATE resource_record_set 
    SET name = '${resourceRecordSetMultilineNameReplace}'
    FROM hosted_zone
    WHERE domain_name = '${replaceDomainName}' AND record_type = '${resourceRecordSetTypeA}';
  `));

  it('applies updates a record name', apply());

  it('check records after update', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => {
    const updated = res.find(r => r.name === resourceRecordSetMultilineNameReplace && r.record_type === resourceRecordSetTypeA);
    console.log(JSON.stringify(updated))
    expect(updated).toBeDefined();
    expect(updated.record_type).toBe(resourceRecordSetTypeA);
    return expect(res.length).toBe(4); 
  }));

  it('deletes records', query(`
    DELETE FROM resource_record_set
    USING hosted_zone
    WHERE hosted_zone.id = parent_hosted_zone_id AND domain_name = '${replaceDomainName}';
  `));

  it('check records after delete', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies deletes records', apply());

  it('check records after delete. SOA and NS recordsets have to be keeped', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('deletes mandatory records and hosted zone', query(`
    BEGIN;
      DELETE FROM resource_record_set
      USING hosted_zone
      WHERE hosted_zone.id = parent_hosted_zone_id AND domain_name = '${replaceDomainName}';
      DELETE FROM hosted_zone
      WHERE domain_name = '${replaceDomainName}';
    COMMIT;
  `));

  it('check records after delete', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check hosted zones after delete', query(`
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies deletes records', apply());

  it('check records after delete', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check hosted zones after delete', query(`
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('Route53 install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'us-east-1', // Share region with common tests
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the route53 module', install(modules));

  it('uninstalls the route53 module', uninstall(modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.db.user,
    true).then(...finish(done)));

  it('uninstalls the route53 module', uninstall(modules));

  it('installs the route53 module', install(modules));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
