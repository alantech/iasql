import { ConfigInterface, throwError } from './config';

const config: ConfigInterface = {
  http: {
    host: 'localhost',
    port: 8088,
    workerPool: true,
  },
  db: {
    host: 'localhost',
    // TODO: Move away from env var to secrets
    user: process.env.DB_USER ?? throwError('No DB User defined'),
    password: process.env.DB_PASSWORD ?? throwError('No DB Password defined'),
    port: 5432,
    forceSSL: true,
    multiUser: true,
  },
  logger: {
    debug: true,
    test: false,
    forceLocal: false,
    logDnaKey: 'b98181227b606d8ee6c5674b5bb948e7',
  },
  sentry: {
    dsn: 'https://e257e8d6646e4657b4f556efc1de31e8@o1090662.ingest.sentry.io/6106929',
    environment: 'production',
  },
  telemetry: {
    posthogKey: 'phc_WjwJsXXSuEl2R2zElUWL55mWpNIfWR8HrFvjxwlTGWH',
  },
};

export default config;
