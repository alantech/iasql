import * as Sentry from '@sentry/react';

import config from '../config';

export function init() {
  if (config.sentry) Sentry.init(config.sentry);
}

export function identify(uid: string, email?: string) {
  if (config.sentry)
    Sentry.setUser({
      id: uid,
      email,
    });
}

export function captureException(error: any) {
  if (config.sentry) Sentry.captureException(error);
}
