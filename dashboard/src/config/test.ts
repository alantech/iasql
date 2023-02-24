import { ConfigInterface } from './config';

const test: ConfigInterface = {
  name: 'test',
  engine: {
    pgHost: 'localhost',
    pgForceSsl: false,
    backendUrl: '/api/run',
  },
};

export default test;
