import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getKeyCertPair,
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
const dbAlias = 'cloudfront';
const callerReference = `${prefix}-caller`;
const s3CallerReference = `s3-${prefix}-caller`;
const originId = `${prefix}-origin-id`;
const s3OriginId = `${prefix}-s3-origin-id`;
const bucket = `${prefix}-bucket`;
const s3OriginId2 = `${prefix}-s3-origin-id-2`;
const bucket2 = `${prefix}-bucket-2`;
const s3OriginId3 = `${prefix}-s3-origin-id-3`;
const bucket3 = `${prefix}-bucket-3`;
const domainName = `${prefix}${dbAlias}.com`;
const [key, cert] = getKeyCertPair(domainName);

const behavior = {
  TargetOriginId: originId,
  ViewerProtocolPolicy: 'allow-all',
  CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
};
const behaviorString = JSON.stringify(behavior);
const origins = [
  {
    DomainName: 'www.google.com',
    Id: originId,
    CustomOriginConfig: { HTTPPort: 80, HTTPSPort: 443, OriginProtocolPolicy: 'https-only' },
  },
];

const s3Origins = [
  {
    DomainName: `${bucket}.s3.amazonaws.com`,
    Id: s3OriginId,
    S3OriginConfig: { OriginAccessIdentity: '' },
    ConnectionAttempts: 3,
    ConnectionTimeout: 10,
  },
  {
    DomainName: `${bucket2}.s3.amazonaws.com`,
    Id: s3OriginId2,
    S3OriginConfig: { OriginAccessIdentity: '' },
    ConnectionAttempts: 3,
    ConnectionTimeout: 10,
  },
  {
    DomainName: `${bucket3}.s3.amazonaws.com`,
    Id: s3OriginId3,
    S3OriginConfig: { OriginAccessIdentity: '' },
    ConnectionAttempts: 3,
    ConnectionTimeout: 10,
  },
];
const s3OriginsString = JSON.stringify(s3Origins);

const originsString = JSON.stringify(origins);
const s3behavior = {
  TargetOriginId: s3OriginId,
  ViewerProtocolPolicy: 'allow-all',
  CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
};
const s3behaviorString = JSON.stringify(s3behavior);

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();
const modules = ['aws_cloudfront', 'aws_s3'];

jest.setTimeout(620000);

beforeAll(async () => {
  // create a test s3 bucket
  await execComposeUp();
});

afterAll(async () => {
  // need to remove the bucket
  await execComposeDown();
});

let username: string, password: string;

describe('Cloudfront Integration Testing', () => {
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

  itDocs('installs the cloudfront module', install(modules));

  it('starts a transaction', begin());

  itDocs(
    'creates a dummy s3 resource',
    query(
      `
        INSERT INTO bucket (name) VALUES ('${bucket}');
        INSERT INTO bucket (name) VALUES ('${bucket2}');
        INSERT INTO bucket (name) VALUES ('${bucket3}');
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the s3 creation', commit());

  it('starts a transaction', begin());

  it(
    'adds a new distribution',
    query(
      `
    INSERT INTO distribution (caller_reference, default_cache_behavior, origins)
    VALUES ('${callerReference}', '${behaviorString}', '${originsString}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it('starts a transaction', begin());

  itDocs('adds a new s3 distribution', (done: (arg0: any) => any) => {
    query(
      `
    INSERT INTO distribution (caller_reference, comment, enabled, is_ipv6_enabled, default_cache_behavior, origins )
    VALUES ('${s3CallerReference}', 'a comment', true, false, '${s3behaviorString}', '${s3OriginsString}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      if (!!e) return done(e);
      done(undefined);
    });
  });

  it('applies the distribution change', commit());

  itDocs(
    'check distribution is available',
    query(
      `
  SELECT * FROM distribution WHERE caller_reference='${s3CallerReference}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'adds a new distribution',
    query(
      `
    INSERT INTO distribution (caller_reference, comment, enabled, is_ipv6_enabled, default_cache_behavior, origins )
    VALUES ('${callerReference}', 'a comment', true, false, '${behaviorString}', '${originsString}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the distribution change', commit());

  itDocs(
    'check distribution is available',
    query(
      `
  SELECT * FROM distribution WHERE caller_reference='${callerReference}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'tries to update distribution comment',
    query(
      `
  UPDATE distribution SET comment='new comment' WHERE caller_reference='${callerReference}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the distribution comment update', commit());

  itDocs(
    'checks that distribution have been modified',
    query(
      `
  SELECT * FROM distribution WHERE caller_reference='${callerReference}' AND comment='new comment';
`,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update distribution id',
    query(
      `
  UPDATE distribution SET distribution_id='fake' WHERE caller_reference='${callerReference}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the distribution id update', commit());

  it(
    'checks that distribution id has not been modified',
    query(
      `
  SELECT * FROM distribution WHERE caller_reference='${callerReference}' AND distribution_id='fake';
`,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update status',
    query(
      `
  UPDATE distribution SET status='fake' WHERE caller_reference='${callerReference}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the status update', commit());

  it(
    'checks that status has not been modified',
    query(
      `
  SELECT * FROM distribution WHERE caller_reference='${callerReference}' AND status='fake';
`,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it('uninstalls the cloudfront module', uninstall(modules));

  it('installs the cloudfront module again (to make sure it reloads stuff)', install(modules));

  it(
    'checks distribution count',
    query(
      `
    SELECT * FROM distribution WHERE caller_reference='${callerReference}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'imports a certificate to use in cloudfront distribution',
    query(`
    SELECT * FROM certificate_import('${cert}', '${key}', 'us-east-1', '{}');
  `),
  );

  it('starts a transaction', begin());
  it(
    'uses that certificate for the distribution',
    query(
      `
          UPDATE distribution
          SET custom_ssl_certificate_id = (SELECT id FROM certificate WHERE domain_name = '${domainName}'),
              alternate_domain_names    = '{${domainName}}'
          WHERE caller_reference = '${callerReference}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the change in distribution certificate', commit());

  it(
    'checks to see if the certificate and alternate domain name still in place',
    query(
      `
      SELECT *
      FROM distribution
      WHERE caller_reference = '${callerReference}';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].custom_ssl_certificate_id).toBeTruthy();
        expect(res[0].alternate_domain_names).toBeTruthy();
      },
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'deletes the distribution',
    query(
      `
    DELETE FROM distribution
    WHERE caller_reference = '${callerReference}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the distribution removal', commit());

  it('starts a transaction', begin());

  itDocs(
    'deletes the s3 bucket',
    query(
      `
    DELETE FROM bucket WHERE name = '${bucket}';
    DELETE FROM bucket WHERE name = '${bucket2}';
    DELETE FROM bucket WHERE name = '${bucket3}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the s3 removal', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('Cloudfront install/uninstall', () => {
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

  it('installs the Cloudfront module', install(modules));

  it('uninstalls the Cloudfront module', uninstall(modules));

  it('installs all modules', installAll());

  it('uninstalls the Cloudfront module', uninstall(['aws_cloudfront']));

  it('installs the Cloudfront module', install(['aws_cloudfront']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
