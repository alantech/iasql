import { ConfigInterface, throwError, } from './config';

const config: ConfigInterface = {
  http: {
    port: 8088,
  },
  db: {
    host: 'db-staging.iasql.com',
    // TODO: Move away from env var to secret
    user: process.env.DB_USER ?? throwError('No DB User defined'),
    password: process.env.DB_PASSWORD ?? throwError('No DB Password defined'),
    port: 5432,
    forceSSL: true,
  },
  logger: {
    debug: true,
    test: false,
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
  },
  telemetry: {
    amplitudeKey: '1510dabbe6997c94b7d0f1959a77fb6e'
  },
  graphql: {
    withGraphiql: false,
  },
};

export default config;
