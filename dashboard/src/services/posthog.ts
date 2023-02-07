import posthog from 'posthog-js';

import config from '../config';

export type EventProps = {
  dbAlias?: string;
  output?: string;
  error?: string;
  sql?: string;
  buttonAlias?: string;
};

export function init() {
  if (config.posthog) {
    posthog.init(config.posthog.key, { api_host: 'https://app.posthog.com' });
  }
}

export function identify(uid: string) {
  if (config.posthog) {
    posthog.identify(uid);
  }
}

export function reset() {
  if (config.posthog) {
    posthog.reset();
  }
}

export async function capture(eventName: string, event: EventProps) {
  if (config.posthog) {
    posthog.capture(eventName, event);
  }
}
