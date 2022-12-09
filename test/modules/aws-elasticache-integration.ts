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
  runInstallAll,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'elasticachetest';
const clusterId = `${prefix}${dbAlias}`;
const newClusterId = `new-${prefix}${dbAlias}`;

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
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
let nodeType: string, updatedNodeType: string;

jest.setTimeout(1240000);
beforeAll(async () => {
  const nodes = await getAvailableNodeTypes();
  nodeType = nodes.pop() ?? '';
  updatedNodeType = nodes.pop() ?? '';
  await execComposeUp();
});
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('Elasticache Integration Testing', () => {
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

  it(
    'adds a new cacheCluster',
    query(
      `  
    INSERT INTO cache_cluster (cluster_id)
    VALUES ('${clusterId}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it('starts a transaction', begin());

  it('adds a new cacheCluster', done => {
    query(
      `
      INSERT INTO cache_cluster (cluster_id, node_type, engine, num_nodes)
      VALUES ('${clusterId}', '${nodeType}', '${cacheType}', 1);
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('applies the cache_cluster change', commit());

  it(
    'check cache_cluster is available',
    query(
      `
  SELECT * FROM cache_cluster WHERE cluster_id='${clusterId}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it('tries to update cache_cluster node type', done => {
    query(
      `
    UPDATE cache_cluster SET node_type='${updatedNodeType}' WHERE cluster_id='${clusterId}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('applies the cache_cluster node_type update', commit());

  it('checks that cache_cluster have been modified', done => {
    query(
      `
  SELECT * FROM cache_cluster WHERE cluster_id='${clusterId}' AND node_type='${updatedNodeType}';
`,
      (res: any) => expect(res.length).toBe(1),
    )((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('starts a transaction', begin());

  it(
    'tries to update cache_cluster engine',
    query(
      `
  UPDATE cache_cluster SET engine='memcached' WHERE cluster_id='${clusterId}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the cache_cluster engine update', commit());

  it(
    'checks that cache_cluster engine has not been modified',
    query(
      `
  SELECT * FROM cache_cluster WHERE cluster_id='${clusterId}' AND engine='${cacheType}'
`,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'checks that cache_cluster with new engine does not exist',
    query(
      `
  SELECT * FROM cache_cluster WHERE cluster_id='${clusterId}' AND engine='memcached';
`,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update cache_cluster id',
    query(
      `
  UPDATE cache_cluster SET cluster_id='${newClusterId}' WHERE cluster_id='${clusterId}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the cache_cluster cluster_id update', commit());

  it(
    'checks that cache_cluster cluster_id have been modified',
    query(
      `
  SELECT * FROM cache_cluster WHERE cluster_id='${newClusterId}';
`,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'checks that older cache_cluster cluster_id does not exist',
    query(
      `
  SELECT * FROM cache_cluster WHERE cluster_id='${clusterId}';
`,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it(
    'checks cache_cluster count of one set',
    query(
      `
    SELECT * FROM cache_cluster WHERE cluster_id='${newClusterId}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes the cache_cluster',
    query(
      `
    DELETE FROM cache_cluster
    WHERE cluster_id = '${newClusterId}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the cache_cluster removal', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('Elasticache install/uninstall', () => {
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

  it('installs the Elasticache module', install(modules));

  it('uninstalls the Elasticache module', uninstall(modules));

  it('installs all modules', installAll());

  it('uninstalls the Elasticache module', uninstall(['aws_elasticache']));

  it('installs the Elasticache module', install(['aws_elasticache']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
