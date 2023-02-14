import { ConfigInterface, throwError } from './config';

const production: ConfigInterface = {
  auth: {
    domain: 'https://auth.iasql.com/',
    audience: 'https://api.iasql.com', // id of this api in auth0
  },
  db: {
    host: 'pg.iasql.com',
    // TODO: Move away from env var to secrets
    user: process.env.DB_USER ?? throwError('No DB User defined'),
    password: process.env.DB_PASSWORD ?? throwError('No DB Password defined'),
    port: 5432,
    forceSSL: true,
  },
  logDna: {
    key: 'b98181227b606d8ee6c5674b5bb948e7',
  },
};

export default production;
