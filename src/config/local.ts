import { ConfigInterface, } from './config';

const config: ConfigInterface = {
  http: {
    port: 8088,
  },
  modules: {
    latestVersion: '0.0.17',
    oldestVersion: '0.0.14'
  },
  db: {
    host: 'postgresql',
    user: 'postgres',
    password: 'test',
    port: 5432,
    forceSSL: false,
    sqlViaRest: true,
  },
  logger: {
    debug: true,
    test: false,
  },
  cors: {
    origin: 'http://localhost:3000'
  },
  telemetry: {
    amplitudeKey: '8fd6aa1d61c115e59e35b3adfd5dd41a'
  },
};

export default config;
