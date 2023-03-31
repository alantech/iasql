import {
  IpAddressType,
  LoadBalancerSchemeEnum,
  LoadBalancerTypeEnum,
} from '../../src/modules/aws_elb/entity';
import * as iasql from '../../src/services/iasql';
import logger from '../../src/services/logger';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  itDocs,
  runBegin,
  runCommit,
  runInstall,
  runInstallAll,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'route53test';
const region = defaultRegion();
const domainName = `${dbAlias}${prefix}.${region}.com.`;
const replaceDomainName = `${dbAlias}${prefix}replace.${region}.com.`;
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

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);

const beginStaging = runBegin.bind(null, dbAlias + 'staging');
const commitStaging = runCommit.bind(null, dbAlias + 'staging');
const installStaging = runInstall.bind(null, dbAlias + 'staging');
const uninstallStaging = runUninstall.bind(null, dbAlias + 'staging');
const queryStaging = runQuery.bind(null, dbAlias + 'staging');

const modules = ['aws_route53', 'aws_acm', 'aws_elb', 'aws_ec2'];

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

// TODO: test more record types
describe('Route53 Integration Testing', () => {
  it('creates a new test db', done => {
    (async () => {
      try {
        const { user, password: pgPassword } = await iasql.connect(dbAlias, 'not-needed', 'not-needed');
        username = user;
        password = pgPassword;
        if (!username || !password) throw new Error('Did not fetch pg credentials');
        done();
      } catch (e) {
        done(e);
      }
    })();
  });

  it('installs the aws_account module', install(['aws_account']));

  it(
    'inserts aws credentials',
    query(
      `
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('starts a transaction', begin());

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(
      `
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs('installs module', install(modules));

  it('starts a transaction', begin());

  it(
    'adds a new hosted zone',
    query(
      `
    INSERT INTO hosted_zone (domain_name)
    VALUES ('${domainName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check adds a new hosted zone',
    query(
      `
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('undo changes', rollback());

  it(
    'check undo adds a new hosted zone',
    query(
      `
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'adds a new hosted zone',
    query(
      `
    INSERT INTO hosted_zone (domain_name)
    VALUES ('${domainName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check adds a new hosted zone',
    query(
      `
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies the hosted zone change', commit());

  itDocs(
    'check adds a new hosted zone',
    query(
      `
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  itDocs(
    'check default record sets have been added',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  /* Confim no cross-contamination between accounts occurs */
  it('creates a second test db', done =>
    void iasql.connect(dbAlias + 'staging', 'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', installStaging(['aws_account']));

  it(
    'inserts aws credentials',
    queryStaging(
      `
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.STAGING_ACCESS_KEY_ID}', '${process.env.STAGING_SECRET_ACCESS_KEY}')
  `,
      undefined,
      false,
    ),
  );

  it('starts a transaction', beginStaging());

  it('syncs the regions', commitStaging());

  it(
    'sets the default region',
    queryStaging(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `),
  );

  it('installs module', installStaging(modules));

  it(
    'check the hosted zone from other account does not exist',
    queryStaging(
      `
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('uninstalls the route53 module', uninstallStaging(modules));

  it('deletes the test db', done =>
    void iasql.disconnect(dbAlias + 'staging', 'not-needed').then(...finish(done)));
  /* Completion of cross-contamination check */

  it('uninstalls the route53 module', uninstall(modules));

  it('installs the route53 module again (to make sure it reloads stuff)', install(modules));

  it(
    'check adds a new hosted zone',
    query(
      `
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check default record sets have been added',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'adds a new record to hosted zone',
    query(
      `
    INSERT INTO resource_record_set (name, record_type, record, ttl, parent_hosted_zone_id)
    SELECT '${resourceRecordSetName}', '${resourceRecordSetTypeCNAME}', '${resourceRecordSetRecord}', ${resourceRecordSetTtl}, id
    FROM hosted_zone
    WHERE domain_name = '${domainName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check default record sets have been added',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(3),
    ),
  );

  it('applies new resource record set', commit());

  itDocs(
    'check default record sets have been added',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(3),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'adds a new A record to hosted zone',
    query(
      `
    BEGIN;
      INSERT INTO load_balancer (load_balancer_name, scheme, load_balancer_type, ip_address_type)
      VALUES ('${lbName}', '${lbScheme}', '${lbType}', '${lbIPAddressType}');

      INSERT INTO alias_target (load_balancer_id)
      VALUES ((SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}'));

      INSERT INTO resource_record_set (name, record_type, parent_hosted_zone_id, alias_target_id)
      SELECT '${aliasResourceRecordSetName}', '${resourceRecordSetTypeA}', hosted_zone.id, alias_target.id
      FROM hosted_zone, alias_target
      INNER JOIN load_balancer ON load_balancer.id = alias_target.load_balancer_id
      WHERE domain_name = '${domainName}' AND load_balancer.load_balancer_name = '${lbName}';
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check alias target record has been added',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(4),
    ),
  );

  it('applies new resource record set', commit());

  itDocs(
    'check alias target record has been added',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(4),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update a hosted zone domain name field (replace)',
    query(
      `
    UPDATE hosted_zone SET domain_name = '${replaceDomainName}' WHERE domain_name = '${domainName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies hosted zone replacement', commit());

  it(
    'check replaced hosted zone',
    query(
      `
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${replaceDomainName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check record sets have been keeped',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `,
      (res: any[]) => expect(res.length).toBe(4),
    ),
  );

  it(
    'check previous record sets have been removed',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'adds a new record to hosted zone',
    query(
      `
    INSERT INTO resource_record_set (name, record_type, record, ttl, parent_hosted_zone_id)
    SELECT '${resourceRecordSetMultilineName}', '${resourceRecordSetTypeA}', '${resourceRecordSetRecordMultiline}', ${resourceRecordSetTtl}, id
    FROM hosted_zone
    WHERE domain_name = '${replaceDomainName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check record sets have been added',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `,
      (res: any[]) => expect(res.length).toBe(5),
    ),
  );

  it('applies new multiline resource record set', commit());

  itDocs(
    'check multiline record set have been added',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `,
      (res: any[]) => {
        logger.info(`${JSON.stringify(res)}`);
        const multiline = res.find(r => {
          logger.info(JSON.stringify(r));
          return r.name === resourceRecordSetMultilineName && r.record_type === resourceRecordSetTypeA;
        });
        expect(multiline).toBeDefined();
        expect(multiline?.record?.split('\n').length).toBe(2);
        return expect(res.length).toBe(5);
      },
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'updates a record name',
    query(
      `
    UPDATE resource_record_set 
    SET name = '${resourceRecordSetMultilineNameReplace}'
    FROM hosted_zone
    WHERE domain_name = '${replaceDomainName}' AND name = '${resourceRecordSetMultilineName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies updates a record name', commit());

  itDocs(
    'check records after update',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `,
      (res: any[]) => {
        const updated = res.find(
          r => r.name === resourceRecordSetMultilineNameReplace && r.record_type === resourceRecordSetTypeA,
        );
        logger.info(JSON.stringify(updated));
        expect(updated).toBeDefined();
        expect(updated.record_type).toBe(resourceRecordSetTypeA);
        return expect(res.length).toBe(5);
      },
    ),
  );

  it('starts a transaction', begin());

  it(
    'creates hosted zone with the same name',
    query(
      `
    INSERT INTO hosted_zone (domain_name) VALUES ('${replaceDomainName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'checks creation of hosted zone with the same name',
    query(
      `
    SELECT * FROM hosted_zone WHERE domain_name = '${replaceDomainName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('applies the hosted zone with the same name', commit());

  it(
    'checks creation of default records',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `,
      (res: any[]) => expect(res.length).toBe(7),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'deletes the hosted zone with the same name',
    query(
      `
    BEGIN;
      DELETE FROM resource_record_set
      USING hosted_zone
      WHERE hosted_zone.id IN (SELECT id FROM hosted_zone WHERE domain_name = '${replaceDomainName}' ORDER BY ID DESC LIMIT 1);
      DELETE FROM hosted_zone
      WHERE id IN (SELECT id FROM hosted_zone WHERE domain_name = '${replaceDomainName}' ORDER BY ID DESC LIMIT 1);
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the removal of hosted zone with the same name', commit());

  it('starts a transaction', begin());

  itDocs(
    'deletes records',
    query(
      `
    DELETE FROM resource_record_set
    USING hosted_zone
    WHERE hosted_zone.id = parent_hosted_zone_id AND domain_name = '${replaceDomainName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check records after delete',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('applies deletes records', commit());

  itDocs(
    'check records after delete. SOA and NS recordsets have to be keeped',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'deletes mandatory records and hosted zone',
    query(
      `
    BEGIN;
      DELETE FROM resource_record_set
      USING hosted_zone
      WHERE hosted_zone.id = parent_hosted_zone_id AND domain_name = '${replaceDomainName}';
      DELETE FROM hosted_zone
      WHERE domain_name = '${replaceDomainName}';
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check records after delete',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check hosted zones after delete',
    query(
      `
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${replaceDomainName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('applies deletes records', commit());

  itDocs(
    'check records after delete',
    query(
      `
    SELECT *
    FROM resource_record_set
    INNER JOIN hosted_zone ON hosted_zone.id = parent_hosted_zone_id
    WHERE domain_name = '${replaceDomainName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  itDocs(
    'check hosted zones after delete',
    query(
      `
    SELECT *
    FROM hosted_zone
    WHERE domain_name = '${replaceDomainName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('Route53 install/uninstall', () => {
  it('creates a new test db', done => {
    (async () => {
      try {
        const { user, password: pgPassword } = await iasql.connect(dbAlias, 'not-needed', 'not-needed');
        username = user;
        password = pgPassword;
        if (!username || !password) throw new Error('Did not fetch pg credentials');
        done();
      } catch (e) {
        done(e);
      }
    })();
  });

  it('installs the aws_account module', install(['aws_account']));

  it(
    'inserts aws credentials',
    query(
      `
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('starts a transaction', begin());

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(
      `
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the route53 module', install(modules));

  it('uninstalls the route53 module', uninstall(modules));

  it('installs all modules', installAll());

  it(
    'uninstalls the route53 module',
    uninstall([
      'aws_acm',
      'aws_elb',
      'aws_ecs_fargate',
      'aws_ecs_simplified',
      'aws_ec2',
      'aws_ec2_metadata',
      'aws_route53',
      'aws_codedeploy',
      'aws_codepipeline',
      'aws_cloudfront',
      'aws_opensearch',
    ]),
  );

  it('installs the route53 module', install(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
