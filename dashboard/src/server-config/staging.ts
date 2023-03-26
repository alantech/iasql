import { ConfigInterface, throwError } from './config';

const staging: ConfigInterface = {
  auth: {
    domain: 'https://auth-staging.iasql.com/',
    audience: 'https://api-staging.iasql.com', // id of this api in auth0
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
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? throwError('No Stripe Secret Key defined'),
    paymentLink: 'https://buy.stripe.com/test_6oE8zSelsgTT0s8001',
  },
};

export default staging;
