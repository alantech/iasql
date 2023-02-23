export const regions = [
  { id: 1, name: 'ap-northeast-1' },
  { id: 2, name: 'ap-northeast-2' },
  { id: 3, name: 'ap-northeast-3' },
  { id: 4, name: 'ap-south-1' },
  { id: 5, name: 'ap-southeast-1' },
  { id: 6, name: 'ap-southeast-2' },
  { id: 7, name: 'ca-central-1' },
  { id: 8, name: 'eu-central-1' },
  { id: 9, name: 'eu-north-1' },
  { id: 10, name: 'eu-west-1' },
  { id: 11, name: 'eu-west-2' },
  { id: 12, name: 'eu-west-3' },
  { id: 13, name: 'sa-east-1' },
  { id: 14, name: 'us-east-1' },
  { id: 15, name: 'us-east-2' },
  { id: 16, name: 'us-west-1' },
  { id: 17, name: 'us-west-2' },
];

export function generateConnectionString(
  dbInfo: { user: string; password: string; id: string },
  pgHost: string,
  forceSsl?: boolean,
) {
  return `postgres://${dbInfo.user}:${dbInfo.password}@${pgHost}/${dbInfo.id}${
    forceSsl ? '?sslmode=no-verify' : ''
  }`;
}
