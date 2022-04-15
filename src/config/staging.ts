import { ConfigInterface, throwError, } from './config';

const config: ConfigInterface = {
  port: 8088,
  dbHost: 'db-staging.iasql.com',
  // TODO: Move away from env var to secret
  dbUser: process.env.DB_USER ?? throwError('No DB User defined'),
  dbPassword: process.env.DB_PASSWORD ?? throwError('No DB Password defined'),
  dbPort: 5432,
  dbForceSSL: true,
  a0Enabled: true,
  a0Domain: 'https://auth.iasql.com/',
  a0Audience: 'https://api.iasql.com', // id of this api in auth0
  sentryEnabled: true,
  sentryDsn: 'https://e255c0c76a554ad491af89119d151e9f@o1090662.ingest.sentry.io/6327420',
  debugLogger: true,
};

export default config;
