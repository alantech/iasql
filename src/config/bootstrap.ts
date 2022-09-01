import { ConfigInterface, throwError } from './config';

const config: ConfigInterface = {
  http: {
    port: 8088,
  },
  modules: {
    latestVersion: '0.0.19',
    oldestVersion: '0.0.15',
  },
  db: {
    host: 'db-bootstrap.iasql.com',
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
  },
  auth: {
    domain: 'https://auth-staging.iasql.com/',
    audience: 'https://api-staging.iasql.com', // id of this api in auth0
  },
  cors: {
    origin: 'http://localhost:3000',
  },
  telemetry: {
    amplitudeKey: '8fd6aa1d61c115e59e35b3adfd5dd41a',
  },
};

export default config;
