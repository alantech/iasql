import config from '../../src/config';
import * as iasql from '../../src/services/iasql';
import {
  runQuery,
  runInstall,
  runUninstall,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
  getPrefix,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'cloudfront';
const callerReference = `${prefix}-caller`;
const s3CallerReference = `s3-${prefix}-caller`;
const originId = `${prefix}-origin-id`;
const s3OriginId = `${prefix}-s3-origin-id`;
const bucket = `${prefix}-bucket`;

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

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
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

describe('Cloudfront Integration Testing', () => {
  it('creates a new test db', done =>
    void iasql.connect(dbAlias, 'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it(
    'inserts aws credentials',
    query(
      `
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_REGION}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `,
      undefined,
      false,
    ),
  );

  it('installs the cloudfront module', install(modules));

  it(
    'creates a dummy s3 resource',
    query(`
    INSERT INTO bucket (name) VALUES ('${bucket}')`),
  );
  it('applies the s3 creation', apply());

  it(
    'adds a new distribution',
    query(`  
    INSERT INTO distribution (caller_reference, default_cache_behavior, origins)
    VALUES ('${callerReference}', '${behaviorString}', '${originsString}');
  `),
  );

  it('undo changes', sync());

  it('adds a new s3 distribution', done => {
    query(`  
    INSERT INTO distribution (caller_reference, comment, enabled, is_ipv6_enabled, default_cache_behavior, origins )
    VALUES ('${s3CallerReference}', 'a comment', true, false, '${s3behaviorString}', '${s3OriginsString}');
  `)((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('applies the distribution change', apply());

  it(
    'check distribution is available',
    query(
      `
  SELECT * FROM distribution WHERE caller_reference='${s3CallerReference}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'adds a new distribution',
    query(`  
    INSERT INTO distribution (caller_reference, comment, enabled, is_ipv6_enabled, default_cache_behavior, origins )
    VALUES ('${callerReference}', 'a comment', true, false, '${behaviorString}', '${originsString}');
  `),
  );

  it('applies the distribution change', apply());

  it(
    'check distribution is available',
    query(
      `
  SELECT * FROM distribution WHERE caller_reference='${callerReference}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'tries to update distribution comment',
    query(`
  UPDATE distribution SET comment='new comment' WHERE caller_reference='${callerReference}';
  `),
  );

  it('applies the distribution comment update', apply());

  it(
    'checks that distribution have been modified',
    query(
      `
  SELECT * FROM distribution WHERE caller_reference='${callerReference}' AND comment='new comment';
`,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'tries to update distribution id',
    query(`
  UPDATE distribution SET distribution_id='fake' WHERE caller_reference='${callerReference}';
  `),
  );

  it('applies the distribution id update', apply());

  it(
    'checks that distribution id has not been modified',
    query(
      `
  SELECT * FROM distribution WHERE caller_reference='${callerReference}' AND distribution_id='fake';
`,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it(
    'tries to update status',
    query(`
  UPDATE distribution SET status='fake' WHERE caller_reference='${callerReference}';
  `),
  );

  it('applies the status update', apply());

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
    'deletes the distribution',
    query(`
    DELETE FROM distribution
    WHERE caller_reference = '${callerReference}';
  `),
  );

  it('applies the distribution removal', apply());

  it(
    'deletes the s3 bucket',
    query(`
    DELETE FROM bucket WHERE name = '${bucket}';
  `),
  );

  it('applies the s3 removal', apply());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('Cloudfront install/uninstall', () => {
  it('creates a new test db', done =>
    void iasql.connect(dbAlias, 'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it(
    'inserts aws credentials',
    query(
      `
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `,
      undefined,
      false,
    ),
  );

  it('installs the Cloudfront module', install(modules));

  it('uninstalls the Cloudfront module', uninstall(modules));

  it('installs all modules', done =>
    void iasql.install([], dbAlias, config.db.user, true).then(...finish(done)));

  it('uninstalls the Cloudfront module', uninstall(['aws_cloudfront']));

  it('installs the Cloudfront module', install(['aws_cloudfront']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
