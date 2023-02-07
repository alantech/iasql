import { ConfigInterface } from './config';

const config: ConfigInterface = {
  http: {
    host: 'host.docker.internal',
    port: 8088,
    workerPool: true,
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
    debug: true,
    test: true,
    forceLocal: false,
  },
  overrideAwsRetryDecider: true,
};

export default config;
