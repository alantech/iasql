import { ConfigInterface, } from './config';

const config: ConfigInterface = {
  port: 8088,
  dbHost: 'postgresql',
  dbUser: 'postgres',
  dbPassword: 'test',
  dbPort: 5432,
  dbForceSSL: false,
  a0Enabled: true,
  a0Domain: 'https://auth.iasql.com/',
  a0Audience: 'https://api.iasql.com', // id of this api in auth0
  sentryEnabled: false,
  sentryDsn: undefined,
  sentryEnvironment: undefined,
  debugLogger: false,
};

export default config;
