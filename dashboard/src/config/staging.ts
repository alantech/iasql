import posthog from 'posthog-js';

import { ConfigInterface } from './config';

const staging: ConfigInterface = !!global.window
  ? {
      name: 'staging',
      auth: {
        domain: 'https://auth-staging.iasql.com',
        clientId: 'OLziMRcBX7XN0ZNSkOcQW4XPufTdWR7l',
        authorizationParams: {
          redirect_uri: window.location.origin,
          scope: 'read:current_user',
          audience: 'https://api-staging.iasql.com',
        },
        useRefreshTokens: true,
      },
      posthog: {
        key: 'phc_r8CxqcF9mvr6lZ6DZkcUcqfomLvI1hEGmHJvncKIMXw',
      },
      sentry: {
        dsn: 'https://47fa499b44b946b3a5089b7a47aaea26@o1090662.ingest.sentry.io/6544496',
        integrations: [new posthog.SentryIntegration(posthog, 'iasql', 6544496)],
        environment: 'staging',
      },
      engine: {
        pgHost: 'pg-staging.iasql.com',
        pgForceSsl: true,
        backendUrl: 'https://app-staging.iasql.com/api/run',
      },
    }
  : ({} as ConfigInterface);

export default staging;
