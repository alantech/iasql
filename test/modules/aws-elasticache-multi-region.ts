import { ElastiCache } from '@aws-sdk/client-elasticache';

import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runBegin,
  runCommit,
  runInstall,
  runQuery,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'elasticachetest';
const newClusterId = `new-${prefix}${dbAlias}`;
const anotherClusterId = `${prefix}${dbAlias}2`;

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const cacheType = 'redis';
const modules = ['aws_elasticache'];

const region = defaultRegion();
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? '';
const elasticacheclient = new ElastiCache({
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  region,
});

const getAvailableNodeTypes = async () => {
  const reservations = await elasticacheclient.describeReservedCacheNodesOfferings({});
  if (reservations && reservations.ReservedCacheNodesOfferings) {
    const items: string[] = [];
    // iterate over list and get the ones matching the product description, and small size
    reservations.ReservedCacheNodesOfferings.forEach(function (node) {
      if (
        node.ProductDescription == cacheType &&
        (node.CacheNodeType?.includes('small') || node.CacheNodeType?.includes('medium'))
      ) {
        if (node.CacheNodeType) items.push(node.CacheNodeType);
      }
    });
    return items ?? [];
  }
  return [];
};
let nodeType: string;

jest.setTimeout(1240000);
beforeAll(async () => {
  const nodes = await getAvailableNodeTypes();
  nodeType = nodes.pop() ?? '';
  await execComposeUp();
});
afterAll(async () => await execComposeDown());

let username: string, password: string;


describe('Elasticache Multi-Region Integration Testing', () => {

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

  it('installs the elasticache module', install(modules));


  it('starts a transaction', begin());

  it('adds a new cacheCluster', done => {
    query(
      `
      INSERT INTO cache_cluster (cluster_id, node_type, engine, num_nodes)
      VALUES ('${newClusterId}', '${nodeType}', '${cacheType}', 1);
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('applies the cache_cluster creation', commit());

  it('starts a transaction', begin());

  it(
    'changes the region the cache_cluster is in',
    query(
      `
    UPDATE cache_cluster SET region='us-east-1' WHERE cluster_id = '${newClusterId}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'checks the region was updated',
    query(
      `
    SELECT * FROM cache_cluster WHERE cluster_id = '${newClusterId}';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].region).toBe('us-east-1');
      },
    ),
  );

  it('starts a transaction', begin());

  it('makes two more cache clusters with the same cluster_id in different regions', done => {
    query(
      `
      INSERT INTO cache_cluster (cluster_id, node_type, engine, num_nodes, region)
      VALUES
        ('${anotherClusterId}', '${nodeType}', '${cacheType}', 1, '${region}'),
        ('${anotherClusterId}', '${nodeType}', '${cacheType}', 1, 'us-east-1');
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('makes the cache_cluster change', commit());

  it('uninstalls the elasticache module', uninstall(modules));

  it('installs the elasticache module again (to make sure it reloads stuff)', install(modules));

  it(
    'checks cache_cluster count of one set',
    query(
      `
    SELECT * FROM cache_cluster WHERE cluster_id='${newClusterId}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'checks cache_cluster count of second set',
    query(
      `
    SELECT * FROM cache_cluster WHERE cluster_id='${anotherClusterId}';
  `,
      (res: any) => expect(res.length).toBe(2),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes the cache_cluster',
    query(
      `
    DELETE FROM cache_cluster
    WHERE cluster_id = '${newClusterId}' OR cluster_id = '${anotherClusterId}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the cache_cluster removal', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
