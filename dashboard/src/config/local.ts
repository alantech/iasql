import posthog from 'posthog-js';

import { ConfigInterface } from './config';

const local: ConfigInterface = {
  engine: {
    pgHost: 'localhost',
    pgForceSsl: false,
    backendUrl: '/api/run',
  },
};
if (process.env.NEXT_PUBLIC_IASQL_TELEMETRY === 'on') {
  local.posthog = {
    key: 'phc_WjwJsXXSuEl2R2zElUWL55mWpNIfWR8HrFvjxwlTGWH',
  };
  local.sentry = {
    dsn: 'https://8ba9a3820f7f4179b5dc12754da9c943@o1090662.ingest.sentry.io/6544238',
    integrations: [new posthog.SentryIntegration(posthog, 'iasql', 6544238)],
    environment: 'local',
  };
}

export default local;
