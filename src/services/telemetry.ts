import * as Amplitude from '@amplitude/node';
import * as sentry from '@sentry/node';
import { PostHog } from 'posthog-node';

import config, { IASQL_ENV } from '../config';
import logger from './logger';

// ! DEPRECATED
// TODO: REMOVE BY THE TIME 0.0.20 BECOMES UNSUPPORTED
enum IasqlOperationType {
  APPLY = 'APPLY',
  SYNC = 'SYNC',
  INSTALL = 'INSTALL',
  UNINSTALL = 'UNINSTALL',
  PLAN_APPLY = 'PLAN_APPLY',
  PLAN_SYNC = 'PLAN_SYNC',
  LIST = 'LIST',
  UPGRADE = 'UPGRADE',
}

const DISCONNECT = 'DISCONNECT';
const singletonAmp = config.telemetry ? Amplitude.init(config.telemetry.amplitudeKey) : undefined;
const singletonPh = config.telemetry
  ? new PostHog(config.telemetry.posthogKey, { host: 'https://app.posthog.com' })
  : undefined;

// TODO remove unused fields after 0.0.20 and make the rest required
// instead of making them all optional
export type DbProps = {
  dbAlias?: string;
  dbId?: string;
  iasqlEnv?: string;
  recordCount?: number;
  operationCount?: number;
  rpcCount?: number;
  email?: string;
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
    dbProps.iasqlEnv = IASQL_ENV;
    if (singletonAmp) {
      await singletonAmp.logEvent({
        event_type: event,
        user_id: uid,
        user_properties: dbProps,
        event_properties: eventProps,
      });
    }
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
            event === DISCONNECT ? [`record_count__${dbProps.dbAlias}`, `rpc_count__${dbProps.dbAlias}`, `version__${dbProps.dbAlias}`] : [],
          $setOnce: {
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

export async function logRunSql(uid: string, dbProps: DbProps, eventProps: EventProps) {
  await logEvent(uid, 'RUNSQL', dbProps, eventProps);
}

// ! DEPRECATED
// TODO: REMOVE BY THE TIME 0.0.20 BECOMES UNSUPPORTED
export async function logOp(
  opType: IasqlOperationType,
  dbProps: DbProps,
  eventProps: EventProps,
  uid: string,
) {
  await logEvent(uid, opType, dbProps, eventProps);
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
