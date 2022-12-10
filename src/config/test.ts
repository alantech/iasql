import { ConfigInterface } from './config';

const config: ConfigInterface = {
  http: {
    port: 8088,
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
