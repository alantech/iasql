import posthog from 'posthog-js';

import { ConfigInterface } from './config';

const production: ConfigInterface = !!global.window
  ? {
      name: 'production',
      auth: {
        domain: 'https://auth.iasql.com',
        clientId: 'OLQAngfr1LnenTt6wmQOYKmzx1c1dSxg',
        authorizationParams: {
          redirect_uri: window.location.origin,
          scope: 'read:current_user',
          audience: 'https://api.iasql.com',
        },
        useRefreshTokens: true,
      },
      posthog: {
        key: 'phc_WjwJsXXSuEl2R2zElUWL55mWpNIfWR8HrFvjxwlTGWH',
      },
      sentry: {
        dsn: 'https://8ba9a3820f7f4179b5dc12754da9c943@o1090662.ingest.sentry.io/6544238',
        integrations: [new posthog.SentryIntegration(posthog, 'iasql', 6544238)],
        environment: 'production',
      },
      engine: {
        pgHost: 'pg.iasql.com',
        pgForceSsl: true,
        backendUrl: 'https://run.iasql.com',
      },
    }
  : ({} as ConfigInterface);

export default production;
