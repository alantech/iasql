import { ConfigInterface } from './config';

const config: ConfigInterface = {
  http: {
    host: 'localhost',
    port: 8088,
    workerPool: false,
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
    test: false,
    forceLocal: true,
    logDnaKey: 'b98181227b606d8ee6c5674b5bb948e7',
  },
};
if (process.env.IASQL_TELEMETRY === 'on') {
  config.telemetry = {
    posthogKey: 'phc_xvAQWfpHug7G0SuU5P9wwAbvP9ZawgAfIEZ9FUsiarS',
  };
}

export default config;
