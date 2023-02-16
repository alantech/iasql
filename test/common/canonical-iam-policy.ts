import { normalizePolicy } from '../../src/services/canonical-iam-policy';

jest.setTimeout(30000);
describe('normalize policy tests', () => {
  test.each([
    ['altogether', {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'MustBeEncryptedInTransit',
          Action: 's3:*',
          Effect: 'Deny',
          Resource: [
            'arn:aws:s3:::scranton-bucket',
            'arn:aws:s3:::scranton-bucket/*',
          ],
          Condition: {
            Bool: {
              'aws:SecureTransport': 'false',
            },
          },
          Principal: '*',
        },
      ],
    }, {
      Statement: [
        {
          Action: ['s3:*'],
          Condition: {
            Bool: {
              'aws:securetransport': ['false'],
            },
          },
          Effect: 'Deny',
          Principal: {
            AWS: ['*'],
          },
          Resource: [
            'arn:aws:s3:::scranton-bucket',
            'arn:aws:s3:::scranton-bucket/*',
          ],
          Sid: 'MustBeEncryptedInTransit',
        },
      ],
      Version: '2012-10-17',
    }],
    ['statement', {
      Version: '2012-10-17',
      Statement: {
        Effect: 'Allow',
        Action: ['s3:PutObject'],
        Resource: ['*'],
      },
    }, {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:putobject'],
          Resource: ['*'],
        },
      ],
    }],
    ['action', {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: 's3:putobject',
          Resource: ['*'],
        },
      ],
    }, {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:putobject'],
          Resource: ['*'],
        },
      ],
    }],
    ['action sort', {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'VisualEditor0',
          Effect: 'Allow',
          Action: [
            's3:List*',
            's3:GetObject*',
            's3:PutObject',
            'ec2:DESCRIBE*',
            'ec2:list*',
          ],
          Resource: '*',
        },
      ],
    }, {
      Statement: [
        {
          Action: [
            'ec2:describe*',
            'ec2:list*',
            's3:getobject*',
            's3:list*',
            's3:putobject',
          ],
          Effect: 'Allow',
          Resource: ['*'],
          Sid: 'VisualEditor0',
        },
      ],
      Version: '2012-10-17',
    }],
    ['principal', {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: 's3:putobject',
          Principal: {
            Service: 'cloudtrail.amazonaws.com',
            AWS: '*',
          },
        },
      ],
    }, {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:putobject'],
          Principal: {
            AWS: ['*'],
            Service: ['cloudtrail.amazonaws.com'],
          },
        },
      ],
    }],
    ['star principal', {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:putobject'],
          Principal: '*',
        },
      ],
    }, {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:putobject'],
          Principal: {
            AWS: [
              '*',
            ],
          },
        },
      ],
    }],
    ['resource', {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: 's3:putobject',
          Resource: '*',
        },
      ],
    }, {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:putobject'],
          Resource: ['*'],
        },
      ],
    }],
    ['condition', {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: 's3:putobject',
          Resource: '*',
          Condition: {
            Bool: {
              'aws:SecureTransport': 'false',
            },
          },
        },
      ],
    }, {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:putobject'],
          Resource: ['*'],
          Condition: {
            Bool: {
              'aws:securetransport': [
                'false',
              ],
            },
          },
        },
      ],
    }],
  ])(
    'normalize test %s',
    (title: string, a: any, b: any) => {
      expect(normalizePolicy(a)).toEqual(normalizePolicy(b)); // b is the normalized form of a
      expect(normalizePolicy(b)).toEqual(b); // b is in normalized form
    },
  );
});