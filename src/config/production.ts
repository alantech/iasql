import { ConfigInterface, throwError, } from './config';

const config: ConfigInterface = {
  http: {
    port: 8088,
  },
  modules: {
    latestVersion: '0.0.3',
  },
  db: {
    host: 'db.iasql.com',
    // TODO: Move away from env var to secrets
    user: process.env.DB_USER ?? throwError('No DB User defined'),
    password: process.env.DB_PASSWORD ?? throwError('No DB Password defined'),
    port: 5432,
    forceSSL: true,
  },
  logger: {
    debug: true,
    test: false,
    logDnaKey: 'b98181227b606d8ee6c5674b5bb948e7',
  },
  auth: {
    domain: 'https://auth.iasql.com/',
    audience: 'https://api.iasql.com', // id of this api in auth0
  },
  cors: {
    origin: 'https://app.iasql.com'
  },
  sentry: {
    dsn: 'https://e257e8d6646e4657b4f556efc1de31e8@o1090662.ingest.sentry.io/6106929',
    environment: 'production',
    release: process.env.SENTRY_RELEASE ?? throwError('No Sentry Release defined'),
  },
  telemetry: {
    amplitudeKey: '968524573d0f8bd2e84460099bca9353'
  },
  graphql: {
    withGraphiql: false,
  },
};

export default config;
