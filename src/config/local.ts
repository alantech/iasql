import { ConfigInterface, } from './config';

const config: ConfigInterface = {
  port: 8088,
  dbHost: 'postgresql',
  dbUser: 'postgres',
  dbPassword: 'test',
  dbPort: 5432,
  dbForceSSL: false,
  a0Enabled: false,
  a0Domain: undefined,
  a0Audience:  undefined,
  sentryEnabled: false,
  sentryDsn: undefined,
  debugLogger: true,
};

export default config;
