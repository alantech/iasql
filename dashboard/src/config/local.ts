import posthog from 'posthog-js';

import { ConfigInterface } from './config';

const local: ConfigInterface = {
  name: 'local',
  engine: {
    pgHost: 'localhost',
    pgForceSsl: false,
    backendUrl: '/api/run',
  },
  posthog: {
    key: 'phc_xvAQWfpHug7G0SuU5P9wwAbvP9ZawgAfIEZ9FUsiarS',
  },
  sentry: {
    dsn: 'https://8ba9a3820f7f4179b5dc12754da9c943@o1090662.ingest.sentry.io/6544238',
    integrations: [new posthog.SentryIntegration(posthog, 'iasql', 6544238)],
    environment: 'local',
  },
  logdna: {
    key: 'b98181227b606d8ee6c5674b5bb948e7',
  },
};

export default local;
