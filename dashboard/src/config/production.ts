import posthog from 'posthog-js';

import { ConfigInterface } from './config';

const production: ConfigInterface = {
  auth: {
    domain: 'https://auth.iasql.com',
    clientId: 'OLQAngfr1LnenTt6wmQOYKmzx1c1dSxg',
    redirectUri: window.location.origin,
    scope: 'read:current_user',
    audience: 'https://api.iasql.com',
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
    pgHost: 'localhost',
    pgForceSsl: true,
    backendUrl: 'http://localhost:8888',
  },
};

export default production;
