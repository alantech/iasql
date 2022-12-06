import { ConfigInterface, throwError } from './config';

const config: ConfigInterface = {
  http: {
    host: 'localhost',
    port: 8088,
  },
  db: {
    host: 'db-staging.iasql.com',
    // TODO: Move away from env var to secret
    user: process.env.DB_USER ?? throwError('No DB User defined'),
    password: process.env.DB_PASSWORD ?? throwError('No DB Password defined'),
    port: 5432,
    forceSSL: true,
    sqlViaRest: true,
  },
  logger: {
    debug: true,
    test: false,
    forceLocal: true,
    logDnaKey: 'b98181227b606d8ee6c5674b5bb948e7',
  },
  auth: {
    domain: 'https://auth-staging.iasql.com/',
    audience: 'https://api-staging.iasql.com', // id of this api in auth0
  },
  cors: {
    origin: 'https://app-staging.iasql.com',
  },
  sentry: {
    dsn: 'https://e255c0c76a554ad491af89119d151e9f@o1090662.ingest.sentry.io/6327420',
    environment: 'staging',
    release: process.env.SENTRY_RELEASE ?? throwError('No Sentry Release defined'),
  },
  telemetry: {
    posthogKey: 'phc_r8CxqcF9mvr6lZ6DZkcUcqfomLvI1hEGmHJvncKIMXw',
  },
};

export default config;
