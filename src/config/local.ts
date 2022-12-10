import { ConfigInterface } from './config';

const config: ConfigInterface = {
  http: {
    host: 'localhost',
    port: 8088,
  },
  db: {
    host: 'localhost',
    user: 'postgres',
    password: 'test',
    port: 5432,
    forceSSL: false,
  },
  logger: {
    debug: true,
    test: false,
    forceLocal: false,
  },
  telemetry: {
    posthogKey: 'phc_xvAQWfpHug7G0SuU5P9wwAbvP9ZawgAfIEZ9FUsiarS',
  },
};

export default config;
