import { ConfigInterface, throwError } from './config';

const staging: ConfigInterface = {
  auth: {
    domain: 'https://auth-staging.iasql.com/',
    audience: 'https://api-staging.iasql.com', // id of this api in auth0
  },
  http: {
    port: 8888,
    corsOrigin: 'https://app-staging.iasql.com',
  },
  db: {
    host: 'pg-staging.iasql.com',
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

export default staging;
