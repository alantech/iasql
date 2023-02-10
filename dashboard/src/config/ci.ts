import { ConfigInterface } from './config';

const ci: ConfigInterface = {
  engine: {
    pgHost: 'localhost',
    pgForceSsl: false,
    backendUrl: 'http://localhost:8888',
  },
};

export default ci;
