import { ConfigInterface } from './config';

const dev: ConfigInterface = {
  http: {
    port: 8888,
  },
  db: {
    host: 'localhost',
    user: 'postgres',
    password: 'test',
    port: 5432,
    forceSSL: false,
  },
};

export default dev;
