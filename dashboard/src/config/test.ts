import { ConfigInterface } from './config';

const test: ConfigInterface = {
  auth: {
    domain: 'https://auth-staging.iasql.com',
    clientId: 'OLziMRcBX7XN0ZNSkOcQW4XPufTdWR7l',
    redirectUri: window.location.origin,
    scope: 'read:current_user',
    audience: 'https://api-staging.iasql.com',
    useRefreshTokens: true,
  },
  engine: {
    pgHost: 'localhost',
    pgForceSsl: false,
    backendUrl: 'http://localhost:8888',
  },
};

export default test;
