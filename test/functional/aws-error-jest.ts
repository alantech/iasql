import { AWS } from '../../src/services/aws_macros';

jest.setTimeout(3000000);


describe('Jest-AWS Error Issue', () => {
  it('triggers AWS error to inspect', async () => {
    // use a debugger to inspect internal sdk error object
    const client = new AWS({
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      region: 'us-east-1',
    });
    const results = await Promise.all(
      [...Array(100).keys()].map(async () =>
        await client.s3Client.listBuckets({}),
      ),
    );
  });
});