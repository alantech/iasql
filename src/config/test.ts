import { ConfigInterface } from './config';

const config: ConfigInterface = {
  http: {
    port: 8088,
  },
  modules: {
    latestVersion: '0.0.19',
    oldestVersion: '0.0.15',
  },
  db: {
    host: 'localhost',
    user: 'postgres',
    password: 'test',
    port: 5432,
    forceSSL: false,
    sqlViaRest: false,
  },
  logger: {
    debug: false,
    test: true,
  },
};

export default config;
