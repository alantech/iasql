import { AWS } from '../../src/services/aws_macros';

const client = new AWS({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  region: 'us-east-1',
});

async function triggerAwsError() {
  // use a debugger to inspect internal sdk error object
  return await Promise.all([...Array(100).keys()].map(async () => await client.s3Client.listBuckets({})));
}

triggerAwsError().then();
