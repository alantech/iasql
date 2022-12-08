import * as sentry from '@sentry/node';
import { PostHog } from 'posthog-node';

import config, { IASQL_ENV } from '../config';
import { throwError } from '../config/config';
import logger from './logger';

const DISCONNECT = 'DISCONNECT';
const singletonPh = config.telemetry
  ? new PostHog(config.telemetry.posthogKey, { host: 'https://app.posthog.com' })
  : undefined;

export type DbProps = {
  dbAlias?: string;
  dbId?: string;
  iasqlEnv?: string;
  recordCount?: number;
  rpcCount?: number;
  email: string;
  dbVersion?: string;
};

export type EventProps = {
  output?: string;
  error?: string;
  dataOnly?: boolean;
  params?: string[];
  sql?: string;
  buttonAlias?: string;
};

export async function logEvent(uid: string, event: string, dbProps: DbProps, eventProps?: EventProps) {
  // make all events uppercase
  event = event.toUpperCase();
  try {
    dbProps.iasqlEnv = IASQL_ENV ?? throwError('IASQL_ENV *must* be defined');
    if (singletonPh) {
      singletonPh.capture({
        event,
        distinctId: uid,
        properties: {
          ...eventProps,
          // set user properties
          $set:
            event !== DISCONNECT
              ? {
                  [`record_count__${dbProps.dbAlias}`]: dbProps.recordCount,
                  [`rpc_count__${dbProps.dbAlias}`]: dbProps.rpcCount,
                  [`version__${dbProps.dbAlias}`]: dbProps.dbVersion,
                }
              : {},
          $unset:
            event === DISCONNECT
              ? [
                  `record_count__${dbProps.dbAlias}`,
                  `rpc_count__${dbProps.dbAlias}`,
                  `version__${dbProps.dbAlias}`,
                ]
              : [],
          $set_once: {
            email: dbProps.email,
          },
        },
      });
    }
  } catch (e: any) {
    const message = `failed to log ${event} event`;
    if (config.sentry) {
      sentry.captureException(e, {
        extra: { message },
      });
    }
    logger.error(message, e);
  }
}

export async function logConnect(uid: string, dbProps: DbProps, eventProps?: EventProps) {
  await logEvent(uid, 'CONNECT', dbProps, eventProps);
}

export async function logDisconnect(uid: string, dbProps: DbProps, eventProps?: EventProps) {
  await logEvent(uid, DISCONNECT, dbProps, eventProps);
}

export async function logExport(uid: string, dbProps: DbProps, eventProps: EventProps) {
  await logEvent(uid, 'EXPORT', dbProps, eventProps);
}

export async function logRpc(
  uid: string,
  moduleName: string,
  methodName: string,
  dbProps: DbProps,
  eventProps: EventProps,
) {
  await logEvent(uid, `${moduleName}:${methodName}`, dbProps, eventProps);
}
