import { ConfigInterface, throwError, } from './config';

const config: ConfigInterface = {
  port: 8088,
  dbHost: process.env.DB_HOST ?? throwError('No DB Host defined'), // TODO: Move away from env var
  dbUser: process.env.DB_USER ?? throwError('No DB User defined'),
  dbPassword: process.env.DB_PASSWORD ?? throwError('No DB Password defined'),
  dbPort: 5432,
  dbForceSSL: true,
  a0Enabled: true,
  a0Domain: process.env.A0_DOMAIN ?? throwError('Auth0 Domain not defined'), // TODO: Put in here
  a0Audience:  process.env.A0_AUDIENCE, // id of this api in auth0
  sentryEnabled: true,
  sentryDsn: process.env.SENTRY_DSN,
};

export default config;
