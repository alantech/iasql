import { ConfigInterface } from '@/config/config';
import * as Sentry from '@sentry/react';

export function init(config: ConfigInterface) {
  if (config?.sentry) Sentry.init(config?.sentry);
}

export function identify(config: ConfigInterface, uid: string, email?: string) {
  if (config?.sentry)
    Sentry.setUser({
      id: uid,
      email,
    });
}

export function captureException(config: ConfigInterface, error: any) {
  if (config?.sentry) Sentry.captureException(error);
}
