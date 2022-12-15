import { ConfigInterface } from './config';

const config: ConfigInterface = {
  http: {
    host: 'host.docker.internal',
    port: 8088,
  },
  db: {
    host: 'localhost',
    user: 'postgres',
    password: 'test',
    port: 5432,
    forceSSL: false,
    multiUser: false,
  },
  logger: {
    debug: false,
    test: true,
    forceLocal: false,
  },
};

export default config;
