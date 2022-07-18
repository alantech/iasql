import { ConfigInterface, } from './config';

const config: ConfigInterface = {
  http: {
    port: 8088,
  },
  modules: {
    latestVersion: '0.0.13',
    oldestVersion: '0.0.10'
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
  graphql: {
    withGraphiql: true,
  },
  telemetry: {
    amplitudeKey: '8fd6aa1d61c115e59e35b3adfd5dd41a'
  },
};

export default config;
