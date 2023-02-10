import { ConfigInterface, throwError } from './config';

const bootstrap: ConfigInterface = {
  http: {
    port: 8888,
  },
  db: {
    host: 'db-bootstrap.iasql.com',
    // TODO: Move away from env var to secret
    user: process.env.DB_USER ?? throwError('No DB User defined'),
    password: process.env.DB_PASSWORD ?? throwError('No DB Password defined'),
    port: 5432,
    forceSSL: true,
  },
  logDna: {
    key: 'b98181227b606d8ee6c5674b5bb948e7',
  },
};

export default bootstrap;
