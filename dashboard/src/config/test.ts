import { ConfigInterface } from './config';

const test: ConfigInterface = {
  engine: {
    pgHost: 'localhost',
    pgForceSsl: false,
    backendUrl: 'http://localhost:9876',
  },
};

export default test;
