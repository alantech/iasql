import { ConfigInterface, } from './config';

const config: ConfigInterface = {
  http: {
    port: 8088,
  },
  modules: {
    latestVersion: '0.0.5',
  },
  db: {
    host: 'postgresql',
    user: 'postgres',
    password: 'test',
    port: 5432,
    forceSSL: false,
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
};

export default config;
