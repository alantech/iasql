import { ConfigInterface } from './config';

const local: ConfigInterface = {
  db: {
    host: 'localhost',
    user: 'postgres',
    password: 'test',
    port: 5432,
    forceSSL: false,
  },
};

export default local;
