import { ConfigInterface, throwError } from './config';

const config: ConfigInterface = {
  http: {
    host: 'localhost',
    port: 8088,
    workerPool: true,
  },
  db: {
    host: 'db-bootstrap.iasql.com',
    // TODO: Move away from env var to secret
    user: process.env.DB_USER ?? throwError('No DB User defined'),
    password: process.env.DB_PASSWORD ?? throwError('No DB Password defined'),
    port: 5432,
    forceSSL: true,
    multiUser: false,
  },
  logger: {
    debug: true,
    test: false,
    forceLocal: false,
  },
};

export default config;
