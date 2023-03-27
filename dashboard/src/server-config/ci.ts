import { ConfigInterface } from './config';

const ci: ConfigInterface = {
  db: {
    host: 'localhost',
    user: 'postgres',
    password: 'test',
    port: 5432,
    forceSSL: false,
  },
};

if (process.env.STRIPE_SECRET_KEY)
  ci.stripe = {
    secretKey: process.env.STRIPE_SECRET_KEY,
    paymentLink: 'https://buy.stripe.com/test_bIY3fy7X4bzz4Io000',
    whitelistedDomains: ['iasql.com', 'alantechnologies.com'],
  };

export default ci;
