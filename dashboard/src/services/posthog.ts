import posthog from 'posthog-js';

import { ConfigInterface } from '@/config/config';

export type EventProps = {
  dbAlias?: string;
  output?: string;
  error?: string;
  sql?: string;
  buttonAlias?: string;
};

export function init(config: ConfigInterface) {
  if (config?.posthog) {
    posthog.init(config?.posthog.key, { api_host: 'https://app.posthog.com', autocapture: false });
  }
}

export function identify(config: ConfigInterface, uid: string) {
  if (config?.posthog) {
    posthog.identify(uid);
  }
}

export function reset(config: ConfigInterface) {
  if (config?.posthog) {
    posthog.reset();
  }
}

export function capture(config: ConfigInterface, eventName: string, event?: EventProps) {
  if (config?.posthog) {
    posthog.capture(eventName, event);
  }
}
