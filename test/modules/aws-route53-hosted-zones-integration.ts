import config from '../../src/config';
import * as iasql from '../../src/services/iasql'
import logger from '../../src/services/logger'
import {
  getPrefix,
  runQuery,
  runInstall,
  runUninstall,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
} from '../helpers'

const {
  IpAddressType,
  LoadBalancerSchemeEnum,
  LoadBalancerTypeEnum,
} = require(`../../src/modules/${config.modules.latestVersion}/aws_elb/entity`);

const prefix = getPrefix();
const dbAlias = 'route53test';
const domainName = `${dbAlias}${prefix}.com.`;
const replaceDomainName = `${dbAlias}${prefix}replace.com.`;
const resourceRecordSetName = `test.${domainName}`;
const aliasResourceRecordSetName = `aliastest.${domainName}`;
const resourceRecordSetMultilineName = `test.multiline.${replaceDomainName}`;
const resourceRecordSetMultilineNameReplace = `replace.test.multiline.${replaceDomainName}`;
const resourceRecordSetTypeCNAME = 'CNAME';
const resourceRecordSetTypeA = 'A';
const resourceRecordSetTtl = 300;
const resourceRecordSetRecord = 'example.com.';
const resourceRecordSetRecordMultiline = `192.168.0.1
192.168.0.2`;
// Load balancer variables
const lbName = `${prefix}${dbAlias}lb`;
const lbScheme = LoadBalancerSchemeEnum.INTERNET_FACING;
const lbType = LoadBalancerTypeEnum.APPLICATION;
const lbIPAddressType = IpAddressType.IPV4;

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
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_REGION}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

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
    INSERT INTO resource_record_set (name, record_type, record, ttl, parent_hosted_zone_id)
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

  it('adds a new A record to hosted zone', query(`
    BEGIN;
      INSERT INTO load_balancer (load_balancer_name, scheme, load_balancer_type, ip_address_type)
      VALUES ('${lbName}', '${lbScheme}', '${lbType}', '${lbIPAddressType}');

      INSERT INTO alias_target (load_balancer_name)
      VALUES ('${lbName}');

      INSERT INTO resource_record_set (name, record_type, parent_hosted_zone_id, alias_target_id)
      SELECT '${aliasResourceRecordSetName}', '${resourceRecordSetTypeA}', hosted_zone.id, alias_target.id
      FROM hosted_zone, alias_target
      INNER JOIN load_balancer ON load_balancer.load_balancer_name = alias_target.load_balancer_name
      WHERE domain_name = '${domainName}' AND load_balancer.load_balancer_name = '${lbName}';
    COMMIT;
  `));

  it('check alias target record has been added', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(4)));

  it('applies new resource record set', apply());

  it('check alias target record has been added', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(4)));

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
  `, (res: any[]) => expect(res.length).toBe(4)));

  it('check previous record sets have been removed', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('adds a new record to hosted zone', query(`
    INSERT INTO resource_record_set (name, record_type, record, ttl, parent_hosted_zone_id)
    SELECT '${resourceRecordSetMultilineName}', '${resourceRecordSetTypeA}', '${resourceRecordSetRecordMultiline}', ${resourceRecordSetTtl}, id
    FROM hosted_zone
    WHERE domain_name = '${replaceDomainName}';
  `));

  it('check record sets have been added', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => expect(res.length).toBe(5)));

  it('applies new multiline resource record set', apply());

  it('check multiline record set have been added', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => {
    logger.info(`${JSON.stringify(res)}`)
    const multiline = res.find(r => {logger.info(JSON.stringify(r)); return r.name === resourceRecordSetMultilineName && r.record_type === resourceRecordSetTypeA});
    expect(multiline).toBeDefined();  
    expect(multiline?.record?.split('\n').length).toBe(2);
    return expect(res.length).toBe(5);
  }));

  it('updates a record name', query(`
    UPDATE resource_record_set 
    SET name = '${resourceRecordSetMultilineNameReplace}'
    FROM hosted_zone
    WHERE domain_name = '${replaceDomainName}' AND name = '${resourceRecordSetMultilineName}';
  `));

  it('applies updates a record name', apply());

  it('check records after update', query(`
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `, (res: any[]) => {
    const updated = res.find(r => r.name === resourceRecordSetMultilineNameReplace && r.record_type === resourceRecordSetTypeA);
    logger.info(JSON.stringify(updated))
    expect(updated).toBeDefined();
    expect(updated.record_type).toBe(resourceRecordSetTypeA);
    return expect(res.length).toBe(5); 
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
    dbAlias, 'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

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
