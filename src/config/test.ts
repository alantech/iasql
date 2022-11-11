import { ConfigInterface } from './config';

const config: ConfigInterface = {
  http: {
    port: 8088,
  },
  modules: {
    latestVersion: '0.0.22',
    oldestVersion: '0.0.18',
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
    forceLocal: false,
  },
};

export default config;
