import { ConfigInterface } from './config';

const config: ConfigInterface = {
  http: {
    port: 8088,
  },
  modules: {
    latestVersion: '0.0.22',
    oldestVersion: '0.0.17',
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
    forceLocal: false,
  },
  cors: {
    origin: 'http://localhost:3000',
  },
  telemetry: {
    posthogKey: 'phc_xvAQWfpHug7G0SuU5P9wwAbvP9ZawgAfIEZ9FUsiarS',
  },
};

export default config;
