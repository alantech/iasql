import { ConfigInterface } from './config';

const dev: ConfigInterface = {
  engine: {
    pgHost: 'localhost',
    pgForceSsl: false,
    backendUrl: 'http://localhost:8888',
  },
};

export default dev;
