import { ConfigInterface } from './config';

const dev: ConfigInterface = {
  engine: {
    pgHost: 'localhost',
    pgForceSsl: false,
    backendUrl: '/api/run',
  },
};

export default dev;
