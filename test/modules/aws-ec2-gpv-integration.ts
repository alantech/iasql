import { EC2 } from '@aws-sdk/client-ec2';

import * as iasql from '../../src/services/iasql';
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

const dbAlias = 'ec2gpvtest';
const region = defaultRegion();
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? '';
const ec2client = new EC2({
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  region,
});
const ubuntuAmiId =
  'resolve:ssm:/aws/service/canonical/ubuntu/server/20.04/stable/current/amd64/hvm/ebs-gp2/ami-id';

const getAvailabilityZones = async () => {
  return await ec2client.describeAvailabilityZones({
    Filters: [
      {
        Name: 'region-name',
        Values: [region],
      },
    ],
  });
};
const getInstanceTypeOffering = async (availabilityZones: string[]) => {
  return await ec2client.describeInstanceTypeOfferings({
    LocationType: 'availability-zone',
    Filters: [
      {
        Name: 'location',
        Values: availabilityZones,
      },
      {
        Name: 'instance-type',
        Values: ['t2.micro', 't3.micro'],
      },
    ],
  });
};

let availabilityZone1: string;
let availabilityZone2: string;

const prefix = getPrefix();
const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);

const gp2VolumeName = `${prefix}gp2volume`;
const gp3VolumeName = `${prefix}gp3volume`;
let instanceType2: string;

const modules = ['aws_ec2', 'aws_ec2_metadata', 'aws_security_group', 'aws_vpc', 'aws_elb', 'aws_iam'];

let username: string, password: string;

jest.setTimeout(560000);
beforeAll(async () => {
  const availabilityZones =
    (await getAvailabilityZones())?.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
  availabilityZone1 = availabilityZones.pop() ?? '';
  availabilityZone2 = availabilityZones.pop() ?? '';
  const instanceTypesByAz2 = await getInstanceTypeOffering([availabilityZone2]);
  instanceType2 = instanceTypesByAz2.InstanceTypeOfferings?.pop()?.InstanceType ?? '';
  await execComposeUp();
});
afterAll(async () => await execComposeDown());

describe('EC2 General Purpose Volume Integration Testing', () => {
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

  itDocs('installs the module', install(modules));

  it('starts a transaction', begin());

  itDocs('creates an instance with specific size', (done: (arg0: any) => any) => {
    query(
      `
      BEGIN;
        INSERT INTO general_purpose_volume (volume_type, size, availability_zone, tags, is_root_device)
        VALUES ('gp2', 15, '${availabilityZone2}', '{"Name": "${gp2VolumeName}"}', TRUE);
        INSERT INTO instance (ami, instance_type, tags, subnet_id)
          SELECT '${ubuntuAmiId}', '${instanceType2}', '{"name":"${prefix}-1"}', id
          FROM subnet
          WHERE availability_zone = '${availabilityZone2}'
          LIMIT 1;
        INSERT INTO instance_block_device_mapping (device_name, volume_id, instance_id) values ('/dev/sda1', (SELECT id FROM general_purpose_volume WHERE tags ->>'Name' = '${gp2VolumeName}' LIMIT 1),
        (SELECT id FROM instance WHERE tags ->>'name' = '${prefix}-1' LIMIT 1));
        
      COMMIT;
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => (!!e ? done(e) : done(undefined)));
  });
  it('creates the instance with specific volume', commit());

  itDocs(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );
  itDocs(
    'check number of volumes',
    query(
      `
    SELECT *
    FROM general_purpose_volume INNER JOIN instance_block_device_mapping ON general_purpose_volume.id = instance_block_device_mapping.volume_id
    WHERE instance_block_device_mapping.instance_id = (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1');
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].size).toBe(15);
      },
    ),
  );

  it('starts a transaction', begin());
  itDocs('creates and attaches an extra volume to instance', (done: (arg0: any) => any) => {
    query(
      `
      BEGIN;
        INSERT INTO general_purpose_volume (volume_type, size, availability_zone, tags)
        VALUES ('gp2', 20, '${availabilityZone2}', '{"Name": "${gp2VolumeName}-2"}');
        INSERT INTO instance_block_device_mapping (device_name, volume_id, instance_id, delete_on_termination) values ('/dev/sda2', (SELECT id FROM general_purpose_volume WHERE tags ->>'Name' = '${gp2VolumeName}-2' LIMIT 1),
        (SELECT id FROM instance WHERE tags ->>'name' = '${prefix}-1' LIMIT 1), FALSE);
        
      COMMIT;
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => (!!e ? done(e) : done(undefined)));
  });
  it('attaches extra volume', commit());

  itDocs(
    'check extra volume has been created',
    query(
      `
    SELECT *
    FROM general_purpose_volume INNER JOIN instance_block_device_mapping ON general_purpose_volume.id = instance_block_device_mapping.volume_id
    WHERE instance_block_device_mapping.instance_id = (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1');
  `,
      (res: any[]) => {
        expect(res.length).toBe(2);
      },
    ),
  );

  it('starts a transaction', begin());

  itDocs('creates an instance with specific size and an extra volume', (done: (arg0: any) => any) => {
    query(
      `
        BEGIN;
        INSERT INTO general_purpose_volume (volume_type, size, availability_zone, tags, is_root_device)
        VALUES ('gp2', 15, '${availabilityZone2}', '{"Name": "${gp2VolumeName}-test-1"}', TRUE),
        VALUES ('gp2', 20, '${availabilityZone2}', '{"Name": "${gp2VolumeName}-test-2"}', TRUE); 

        INSERT INTO instance (ami, instance_type, tags, subnet_id)
          SELECT '${ubuntuAmiId}', '${instanceType2}', '{"name":"${prefix}-2"}', id
          FROM subnet
          WHERE availability_zone = '${availabilityZone2}'
          LIMIT 1;
          INSERT INTO instance_block_device_mapping (device_name, volume_id, instance_id) values ('/dev/sda1', (SELECT id FROM general_purpose_volume WHERE tags ->>'Name' = '${gp2VolumeName}-test-1' LIMIT 1),
          (SELECT id FROM instance WHERE tags ->>'name' = '${prefix}-2' LIMIT 1)),
          ('/dev/sdb', (SELECT id FROM general_purpose_volume WHERE tags ->>'Name' = '${gp2VolumeName}-test-2' LIMIT 1),
          (SELECT id FROM instance WHERE tags ->>'name' = '${prefix}-2' LIMIT 1)),
          ('/dev/sdc', NULL, (SELECT id FROM instance WHERE tags ->>'name' = '${prefix}-2' LIMIT 1));        
      COMMIT;
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => (!!e ? done(e) : done(undefined)));
  });
  it('creates the instance with specific volumes', commit());

  itDocs(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );
  itDocs(
    'check number of volumes',
    query(
      `
    SELECT *
    FROM general_purpose_volume INNER JOIN instance_block_device_mapping ON general_purpose_volume.id = instance_block_device_mapping.volume_id
    WHERE instance_block_device_mapping.instance_id = (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-2');
  `,
      (res: any[]) => {
        expect(res.length).toBe(2);
        expect(res[0].size).toBe(15);
        expect(res[1].size).toBe(20);
      },
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes all ec2 instances',
    query(
      `
      DELETE FROM instance
      WHERE tags ->> 'name' = '${prefix}-1' OR tags ->> 'name' = '${prefix}-2';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the instances deletion', commit());

  it(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1' OR tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check extra volume remains',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}-2';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'deletes extra volume',
    query(
      `
      DELETE FROM general_purpose_volume
      WHERE tags ->> 'Name' = '${gp2VolumeName}-2';  
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'check number of volumes',
    query(
      `
    SELECT *
    FROM general_purpose_volume INNER JOIN instance_block_device_mapping ON general_purpose_volume.id = instance_block_device_mapping.volume_id
    WHERE instance_block_device_mapping.instance_id = (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1' OR tags ->> 'name' = '${prefix}-2');
  `,
      (res: any[]) => {
        expect(res.length).toBe(0);
      },
    ),
  );

  it('starts a transaction', begin());

  it('adds new volumes', done => {
    query(
      `
      BEGIN;
        INSERT INTO general_purpose_volume (volume_type, availability_zone, tags)
        VALUES ('gp2', '${availabilityZone2}', '{"Name": "${gp2VolumeName}"}');

        INSERT INTO general_purpose_volume (volume_type, availability_zone, size, tags)
        VALUES ('gp3', '${availabilityZone1}', 50, '{"Name": "${gp3VolumeName}"}');
      COMMIT;
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => (!!e ? done(e) : done()));
  });

  it(
    'checks volume count',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('sync before apply', rollback());

  it(
    'checks volume count',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  itDocs('adds new volumes', (done: (arg0: any) => any) => {
    query(
      `
      BEGIN;
        INSERT INTO general_purpose_volume (volume_type, availability_zone, tags)
        VALUES ('gp2', '${availabilityZone2}', '{"Name": "${gp2VolumeName}"}');

        INSERT INTO general_purpose_volume (volume_type, availability_zone, size, tags)
        VALUES ('gp3', '${availabilityZone1}', 50, '{"Name": "${gp3VolumeName}"}');
      COMMIT;
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => (!!e ? done(e) : done(undefined)));
  });

  itDocs(
    'checks volume count',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('applies the change', commit());

  it(
    'checks volume count',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('uninstalls the module', uninstall(modules));

  it('installs the module', install(modules));

  it(
    'checks volume count',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update a volume field to be restored',
    query(
      `
    UPDATE general_purpose_volume SET state = 'creating' WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change which will undo the change', commit());

  it(
    'checks volume restored',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `,
      (res: any[]) => expect(res[0].state).toBe('available'),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'tries to update a volume size',
    query(
      `
    UPDATE general_purpose_volume SET size = 150 WHERE tags ->> 'Name' = '${gp3VolumeName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  itDocs(
    'checks volume update',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res[0].size).toBe(150),
    ),
  );

  it('starts a transaction', begin());

  itDocs('tries to update a volume availability zone', (done: (arg0: any) => any) => {
    query(
      `
      UPDATE general_purpose_volume
      SET availability_zone = '${availabilityZone2}'
      WHERE tags ->> 'Name' = '${gp3VolumeName}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => (!!e ? done(e) : done(undefined)));
  });

  it('applies the change', commit());

  it(
    'checks volume count',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it(
    'checks volume replace',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res[0].availability_zone).toBe(availabilityZone2),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update a volume availability zone',
    query(
      `
    UPDATE general_purpose_volume SET tags = '{"Name": "${gp2VolumeName}", "updated": true}' WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'checks volume update',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `,
      (res: any[]) => expect(res[0].tags.updated).toBe('true'),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'deletes the volumes',
    query(
      `
    DELETE FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'check deletes the volumes',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
    `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  itDocs(
    'gets information about an AMI',
    query(
      `
      SELECT * from describe_ami('${ubuntuAmiId}')
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].status).toBe('OK');
      },
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('EC2 install/uninstall', () => {
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

  // Install can automatically pull in all dependencies, so we only need to specify ec2 here
  it('installs the ec2 module', install(['aws_ec2']));

  // But uninstall won't uninstall dependencies, so we need to specify that we want all three here
  it('uninstalls the ec2 module', uninstall(modules));

  it('installs all modules', installAll());

  it(
    'uninstall ec2 using overloaded sp',
    query(`
    select iasql_uninstall('aws_ec2_metadata');
  `),
  );

  it(
    'install ec2 using overloaded sp',
    query(`
    select iasql_install('aws_ec2_metadata');
  `),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
