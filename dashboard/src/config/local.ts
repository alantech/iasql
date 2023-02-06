import { ConfigInterface } from './config';

const local: ConfigInterface = {
  engine: {
    pgHost: 'localhost',
    pgForceSsl: false,
    backendUrl: 'http://localhost:8888',
  },
};

export default local;
