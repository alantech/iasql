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
  runQuery,
  runUninstall,
} from '../helpers';

declare function fetch(input: Request | string, init?: RequestInit): Promise<Response>;

const dbAlias = 'sshaccounttest';
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
let instanceType1: string;
const ubuntuAmiId =
  'resolve:ssm:/aws/service/canonical/ubuntu/server/20.04/stable/current/amd64/hvm/ebs-gp2/ami-id';

const prefix = getPrefix();
const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);

const modules = ['aws_ec2', 'aws_ec2_metadata', 'ssh_accounts', 'ssh_docker'];

jest.setTimeout(560000);
beforeAll(async () => {
  const availabilityZones =
    (await getAvailabilityZones())?.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
  availabilityZone1 = availabilityZones.pop() ?? '';
  const instanceTypesByAz1 = await getInstanceTypeOffering([availabilityZone1]);
  instanceType1 = instanceTypesByAz1.InstanceTypeOfferings?.pop()?.InstanceType ?? '';
  await execComposeUp();
});
afterAll(async () => await execComposeDown());

let username: string, password: string, privateKey: string;

describe('SSH Accounts Integration Testing', () => {
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
          UPDATE aws_regions
          SET is_default = TRUE
          WHERE region = '${region}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the ec2 module', install(['aws_ec2']));

  // generate keypairs
  it(
    'generates a new keypair',
    query(
      `
    SELECT * FROM key_pair_request ('${prefix}-key-request', '${region}');
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        privateKey = res[0].privatekey;
      },
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check new keypair added',
    query(
      `
    SELECT *
    FROM key_pair
    WHERE name = '${prefix}-key-request';
  `,
      (res: any[]) => expect(res.length).toBe(1),
      true,
      () => ({ username, password }),
    ),
  );

  it('starts a transaction', begin());

  it('adds an ec2 instance with this private key', done => {
    query(
      `
      BEGIN;
        INSERT INTO security_group (description, group_name)
        VALUES ('ssh security group', 'ssh-${prefix}-sg');

        INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
        SELECT true, 'tcp', 1, 65535, '0.0.0.0/0', '${prefix}outbound', id
        FROM security_group
        WHERE group_name = 'ssh-${prefix}-sg';

        INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
        SELECT false, 'tcp', 22, 22, '0.0.0.0/0', '${prefix}sshrule', id
        FROM security_group
        WHERE group_name = 'ssh-${prefix}-sg';

        INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
        SELECT false, 'tcp', 8080, 8080, '0.0.0.0/0', '${prefix}httpdrule', id
        FROM security_group
        WHERE group_name = 'ssh-${prefix}-sg';

        INSERT INTO instance (ami, instance_type, key_pair_name, tags, subnet_id, user_data)
          SELECT '${ubuntuAmiId}', '${instanceType1}', '${prefix}-key-request', '{"name":"ssh-${prefix}-1"}', id, '#!/bin/bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo mkdir -m 0755 -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io
sudo groupadd docker
sudo usermod -aG docker ubuntu
newgrp docker'
          FROM subnet
          WHERE availability_zone = '${availabilityZone1}'
          LIMIT 1;

        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = 'ssh-${prefix}-1'),
          (SELECT id FROM security_group WHERE group_name='ssh-${prefix}-sg' AND region = '${region}');
      COMMIT;
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('commits the transaction', commit());

  it('installs the ssh_accounts and aws_ec2_metadata modules', install(['ssh_accounts', 'aws_ec2_metadata']));

  itDocs('adds a new ssh server', (done: (e?: Error) => any) => {
    query(
      `
          INSERT INTO ssh_credentials ("name", hostname, username, private_key)
          VALUES ('${prefix}', (SELECT host(im.public_ip_address)
                                FROM instance_metadata im
                                         INNER JOIN instance i ON im.instance_id = i.instance_id
                                WHERE i.tags ->> 'name' = 'ssh-${prefix}-1'
                                LIMIT 1), 'ubuntu', $$${privateKey}$$);
      `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  itDocs(
    'waits for cloud-init to finish',
    query(
      `
    SELECT * FROM ssh_exec('${prefix}', 'cloud-init status --wait');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'checks docker is running',
    query(
      `
    SELECT * FROM ssh_exec('${prefix}', 'docker ps');
  `,
      (res: any[]) => expect(res[0].stdout.trim()).toContain('CONTAINER ID'),
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the ssh_docker modules', install(['ssh_docker']));

  it('starts a transaction', begin());
  it(
    'creates a new httpd container',
    query(
      `
          INSERT INTO docker_container (server_name, name, image, ports, state)
          VALUES ('${prefix}', 'httpd-container', 'httpd',
                  '{"80/tcp": [{"HostIp": "", "HostPort": "8080"}]}', 'running');
      `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );
  it('commits creation of the httpd server', commit());

  it('can access the httpd server', query(`
      SELECT host(im.public_ip_address) as ip
      FROM instance_metadata im
               INNER JOIN instance i ON im.instance_id = i.instance_id
      WHERE i.tags ->> 'name' = 'ssh-${prefix}-1'
      LIMIT 1
   `, (res: any[]) => {
    fetch('http://' + res[0].ip + ':8080', {
      method: 'GET',
    }).then((r: any) => r.text()).then((r: any) => expect(r).toContain('It works!'));
  }));

  it('starts a transaction', begin());

  itDocs(
    'deletes the ssh server',
    query(
      `
    DELETE FROM ssh_credentials WHERE "name" = '${prefix}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the ssh deletion', commit());

  it('starts a transaction', begin());

  it(
    'deletes the ec2 instance',
    query(
      `
    DELETE FROM instance WHERE tags ->> 'name' = 'ssh-${prefix}-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the ec2 deletion', commit());

  it('starts a transaction', begin());
  it(
    'deletes the keypair',
    query(
      `
    DELETE FROM key_pair
    WHERE name = '${prefix}-key-request';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the keypair deletion', commit());

  it(
    'confirms keypair deleted',
    query(
      `
    SELECT *
    FROM key_pair
    WHERE name = '${prefix}-key-request';
  `,
      (res: any[]) => expect(res.length).toBe(0),
      true,
      () => ({ username, password }),
    ),
  );

  it('starts a transaction', begin());
  it(
    'deletes the security group',
    query(
      `
    DELETE FROM security_group_rule WHERE description = '${prefix}sshrule';
    DELETE FROM security_group_rule WHERE description = '${prefix}httpdrule';
    DELETE FROM security_group WHERE group_name = 'ssh-${prefix}-sg';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the security group deletion', commit());

  it('uninstalls the modules', uninstall(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
