import { ConfigInterface } from './config';

const dev: ConfigInterface = {
  name: 'dev',
  engine: {
    pgHost: 'localhost',
    pgForceSsl: false,
    backendUrl: '/api/run',
  },
};

export default dev;
