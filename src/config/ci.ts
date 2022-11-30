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
    sqlViaRest: true,
  },
  logger: {
    debug: true,
    test: false,
    forceLocal: false,
  },
  cors: {
    origin: 'http://localhost:3000',
  },
};

export default config;
