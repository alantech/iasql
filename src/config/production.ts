import { ConfigInterface, throwError, } from './config';

const config: ConfigInterface = {
  port: 8088,
  dbHost: 'db.iasql.com',
  // TODO: Move away from env var to secrets
  dbUser: process.env.DB_USER ?? throwError('No DB User defined'),
  dbPassword: process.env.DB_PASSWORD ?? throwError('No DB Password defined'),
  dbPort: 5432,
  dbForceSSL: true,
  a0Enabled: true,
  a0Domain: 'https://auth.iasql.com/',
  a0Audience: 'https://api.iasql.com', // id of this api in auth0
  sentryEnabled: true,
  sentryEnvironment: 'production',
  sentryDsn: 'https://e257e8d6646e4657b4f556efc1de31e8@o1090662.ingest.sentry.io/6106929',
};

export default config;
