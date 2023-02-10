import { ConfigInterface } from './config';

const bootstrap: ConfigInterface = {
  engine: {
    pgHost: 'localhost',
    pgForceSsl: false,
    backendUrl: 'http://localhost:8888',
  },
};

export default bootstrap;
