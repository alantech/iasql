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
  runRestore,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 's3test';
const s3Name = `${prefix}${dbAlias}`;
const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const restore = runRestore.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_s3'];
const region = defaultRegion();
const nonDefaultRegion = 'us-east-1';

const policyJSON = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'SamplePolicy',
      Effect: 'Allow',
      Principal: '*',
      Action: ['s3:GetObject'],
      Resource: ['arn:aws:s3:::' + s3Name + '/*'],
    },
  ],
};
const policyDocument = JSON.stringify(policyJSON);
policyJSON.Statement[0].Sid = 'UpdatePolicy';
const newPolicyDocument = JSON.stringify(policyJSON);

const updatedPolicyJSON = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'SamplePolicy',
      Effect: 'Allow',
      Principal: '*',
      Action: 's3:GetObject',
      Resource: 'arn:aws:s3:::' + s3Name + '/*',
    },
  ],
};

const bucketContent = JSON.stringify({
  name: 'Iasql',
  value: 'Hello world!',
});

const updatedPolicyDocument = JSON.stringify(updatedPolicyJSON);
updatedPolicyJSON.Statement[0].Sid = 'UpdatePolicy';
const updatedNewPolicyDocument = JSON.stringify(updatedPolicyJSON);

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('S3 Integration Testing', () => {
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

  it('installs the s3 module', install(modules));

  it('starts a transaction', begin());

  it(
    'adds a new s3 bucket',
    query(
      `  
    INSERT INTO bucket (name)
    VALUES ('${s3Name}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', restore());

  it(
    'check bucket insertion',
    query(
      `
    SELECT *
    FROM bucket 
    WHERE name = '${s3Name}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'adds a new s3 bucket',
    query(
      `  
    INSERT INTO bucket (name, policy_document)
    VALUES ('${s3Name}', '${policyDocument}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the s3 bucket change', commit());

  it(
    'check s3 insertion',
    query(
      `
    SELECT *
    FROM bucket 
    WHERE name = '${s3Name}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'inserts content into bucket object',
    query(
      `INSERT INTO bucket_object (bucket_name, key, region) VALUES ('${s3Name}', 'fake_bucket', '${region}')`,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the s3 object removal', commit());

  it(
    'check fake object deletion',
    query(
      `
    SELECT *
    FROM bucket_object 
    WHERE bucket_name = '${s3Name}' AND key='fake_bucket';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'adds content to bucket',
    query(
      `SELECT * FROM s3_upload_object('${s3Name}', 'iasql_message', '${bucketContent}', 'application/json')`,
      (res: any[]) => expect(res[0].status).toStrictEqual('OK'),
    ),
  );
  it(
    'adds new content to bucket',
    query(
      `SELECT * FROM s3_upload_object('${s3Name}', 'iasql_message_1', '${bucketContent}', 'application/json')`,
      (res: any[]) => expect(res[0].status).toStrictEqual('OK'),
    ),
  );

  it(
    'check object insertion',
    query(
      `
    SELECT *
    FROM bucket_object 
    WHERE bucket_name = '${s3Name}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes one object of the bucket',
    query(
      `
    DELETE FROM bucket_object WHERE bucket_name = '${s3Name}' AND key='iasql_message';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the s3 object removal', commit());

  it(
    'check object deletion',
    query(
      `
    SELECT *
    FROM bucket_object 
    WHERE bucket_name = '${s3Name}' AND key='iasql_message';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );
  it(
    'check object deletion',
    query(
      `
    SELECT *
    FROM bucket_object 
    WHERE bucket_name = '${s3Name}' AND key='iasql_message_1';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'gets current bucket policy document',
    query(
      `
    SELECT * FROM bucket WHERE name = '${s3Name}';
    `,
      (res: any[]) => expect(res[0].policy_document).toStrictEqual(JSON.parse(updatedPolicyDocument)),
    ),
  );

  it('starts a transaction', begin());

  it(
    'updates the bucket timestamp',
    query(
      `
    UPDATE bucket SET created_at = '1984-01-01T00:00:00' WHERE name = '${s3Name}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the s3 bucket update', commit());

  it(
    'check s3 bucket timestamp is reverted',
    query(
      `
    SELECT *
    FROM bucket 
    WHERE name='${s3Name}' AND created_at = '1984-01-01T00:00:00';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check s3 bucket does still exist',
    query(
      `
    SELECT *
    FROM bucket 
    WHERE name = '${s3Name}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'cleans the bucket',
    query(
      `
        DELETE FROM bucket_object WHERE bucket_name='${s3Name}'
      `,
      undefined,
      true,
      () => ({
        username,
        password,
      }),
    ),
  );

  it(
    'check no s3 objects still exist',
    query(
      `
    SELECT *
    FROM bucket_object 
    WHERE bucket_name = '${s3Name}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  describe('S3 bucket policy integration testing', () => {
    it(
      'gets current bucket policy',
      query(
        `
    SELECT policy_document FROM bucket
    WHERE name = '${s3Name}';
    `,
        (res: any[]) => {
          expect(res.length).toBe(1);
          expect(res[0].policyDocument).toBe(undefined);
        },
      ),
    );

    it(
      'updates the bucket policy',
      query(
        `
          UPDATE bucket SET policy_document='${newPolicyDocument}' WHERE name = '${s3Name}';
        `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );
    it('applies the s3 bucket policy update', commit());

    it(
      'gets current bucket policy with updated document',
      query(
        `
    SELECT * FROM bucket WHERE name = '${s3Name}';
    `,
        (res: any[]) => expect(res[0].policy_document).toStrictEqual(JSON.parse(updatedNewPolicyDocument)),
      ),
    );
  });

  it('starts a transaction', begin());

  it(
    'adds a new public access block entry',
    query(
      `
      INSERT INTO public_access_block (bucket_name, block_public_acls, ignore_public_acls, block_public_policy,
                                       restrict_public_buckets)
      VALUES ('${s3Name}', false, false, false, false)
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies creation of public access block', commit());

  it(
    'checks the public access block exists',
    query(
      `
              SELECT *
              FROM public_access_block
              WHERE bucket_name = '${s3Name}'
                AND block_public_acls = FALSE
                AND ignore_public_acls = FALSE
                AND block_public_policy = FALSE
                AND restrict_public_buckets = FALSE
    `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('checks can not add another public access block', () => {
    try {
      query(
        `
                  INSERT INTO public_access_block (bucket_name)
                  VALUES ('${s3Name}');
        `,
        undefined,
        true,
        () => ({ username, password }),
      );
    } catch (e) {
      expect(e).toBeTruthy();
    }
  });

  it('starts a transaction', begin());

  it(
    'change the public access block',
    query(
      `
      UPDATE public_access_block
      SET block_public_acls = true
      WHERE bucket_name = '${s3Name}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies update of public access block', commit());

  it(
    'checks public access block is updated',
    query(
      `
      SELECT *
      FROM public_access_block
      WHERE bucket_name = '${s3Name}'
        AND block_public_acls = TRUE
        AND ignore_public_acls = FALSE
        AND block_public_policy = FALSE
        AND restrict_public_buckets = FALSE
    `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'removes the public block entry',
    query(
      `
      DELETE
      FROM public_access_block
      WHERE bucket_name = '${s3Name}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies deletion of public access block', commit());

  it('starts a transaction', begin());

  it(
    'adds a static website to bucket',
    query(
      `
      INSERT INTO bucket_website (bucket_name, index_document)
      VALUES ('${s3Name}', 'index.html')
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies creation of static website', commit());

  it(
    'checks the static website exists',
    query(
      `
              SELECT *
              FROM bucket_website
              WHERE bucket_name = '${s3Name}'
                AND index_document = 'index.html'
    `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('checks can not add another static website', () => {
    try {
      query(
        `
                  INSERT INTO bucket_website (bucket_name, index_document)
                  VALUES ('${s3Name}', 'test.html');
        `,
        undefined,
        true,
        () => ({ username, password }),
      );
    } catch (e) {
      expect(e).toBeTruthy();
    }
  });

  it('starts a transaction', begin());

  it(
    'change the static website',
    query(
      `
      UPDATE bucket_website
      SET error_document = 'error.html'
      WHERE bucket_name = '${s3Name}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies update of static website', commit());

  it(
    'checks static website is updated',
    query(
      `
      SELECT *
      FROM bucket_website
      WHERE bucket_name = '${s3Name}'
        AND index_document = 'index.html' AND error_document = 'error.html'
    `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'removes the static website',
    query(
      `
      DELETE
      FROM bucket_website
      WHERE bucket_name = '${s3Name}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies deletion of static website', commit());

  it('should fail when changing the region', () => {
    try {
      query(
        `
      UPDATE bucket SET region='${nonDefaultRegion}' WHERE name = '${s3Name}';
      `,
        undefined,
        true,
        () => ({ username, password }),
      );
    } catch (e) {
      expect(e).toBeTruthy();
    }
  });

  it('should fail when changing the name', () => {
    try {
      query(
        `
      UPDATE bucket SET name='${nonDefaultRegion}' WHERE name = '${s3Name}';
      `,
        undefined,
        true,
        () => ({ username, password }),
      );
    } catch (e) {
      expect(e).toBeTruthy;
    }
  });

  it('uninstalls the s3 module', uninstall(modules));

  it('installs the s3 module', install(modules));

  it(
    're-adds content to bucket',
    query(
      `SELECT * FROM s3_upload_object('${s3Name}', 'iasql_message', '${bucketContent}', 'application/json')`,
      (res: any[]) => expect(res[0].status).toStrictEqual('OK'),
    ),
  );

  it(
    'checks object re-creation',
    query(
      `
    SELECT *
    FROM bucket_object 
    WHERE bucket_name = '${s3Name}';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        console.log(res);
      },
    ),
  );

  it('starts a transaction', begin());

  it(
    'cleans the bucket again',
    query(
      `
        DELETE FROM bucket_object WHERE bucket_name='${s3Name}'
      `,
      undefined,
      false,
      () => ({
        username,
        password,
      }),
    ),
  );

  it(
    'checks object re-deletion',
    query(
      `
    SELECT *
    FROM bucket_object 
    WHERE bucket_name = '${s3Name}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'deletes the s3 bucket',
    query(
      `
    DELETE FROM bucket WHERE name = '${s3Name}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the s3 bucket removal', commit());

  it(
    'check s3 removal',
    query(
      `
    SELECT *
    FROM bucket 
    WHERE name = '${s3Name}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('S3 install/uninstall', () => {
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

  it(
    'installs the S3 module and confirms one table is created',
    query(
      `
    select * from iasql_install('aws_s3');
  `,
      (res: any[]) => {
        expect(res.length).toBe(4);
      },
    ),
  );

  it(
    'uninstalls the S3 module and confirms one table is removed',
    query(
      `
    select * from iasql_uninstall('aws_s3');
  `,
      (res: any[]) => {
        expect(res.length).toBe(4);
      },
    ),
  );

  it('installs all modules', installAll());

  it('uninstalls the S3 module', uninstall(['aws_s3']));

  it('installs the S3 module', install(['aws_s3']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
