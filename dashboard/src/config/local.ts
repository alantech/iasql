import { ConfigInterface } from './config';

const local: ConfigInterface = {
  engine: {
    pgHost: 'localhost',
    pgForceSsl: false,
    backendUrl: '/api/run',
  },
};

export default local;
