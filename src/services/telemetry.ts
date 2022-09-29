import * as Amplitude from '@amplitude/node';
import * as sentry from '@sentry/node';

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

const singleton = config.telemetry ? Amplitude.init(config.telemetry.amplitudeKey) : undefined;

export type DbProps = {
  dbAlias?: string;
  dbId?: string;
  iasqlEnv?: string;
  recordCount?: number;
  operationCount?: number;
  rpcCount?: number;
  email?: string;
};

export type EventProps = {
  output?: string;
  error?: string;
  dataOnly?: boolean;
  params?: string[];
  sql?: string;
};

export async function logEvent(
  event: string,
  dbProps: DbProps,
  eventProps?: EventProps,
  uid?: string,
  deviceId?: string,
) {
  if (!singleton) return;
  try {
    dbProps.iasqlEnv = IASQL_ENV;
    await singleton.logEvent({
      event_type: event,
      user_id: uid,
      user_properties: dbProps,
      event_properties: eventProps,
      device_id: deviceId,
    });
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

export async function logConnect(dbProps: DbProps, eventProps?: EventProps, uid?: string, deviceId?: string) {
  await logEvent('CONNECT', dbProps, eventProps, uid, deviceId);
}

export async function logDisconnect(dbProps: DbProps, eventProps?: EventProps, uid?: string) {
  await logEvent('DISCONNECT', dbProps, eventProps, uid);
}

export async function logExport(dbProps: DbProps, eventProps: EventProps, uid: string, deviceId?: string) {
  await logEvent('EXPORT', dbProps, eventProps, uid, deviceId);
}

export async function logRunSql(dbProps: DbProps, eventProps: EventProps, uid?: string, deviceId?: string) {
  await logEvent('RUNSQL', dbProps, eventProps, uid, deviceId);
}

// ! DEPRECATED
// TODO: REMOVE BY THE TIME 0.0.20 BECOMES UNSUPPORTED
export async function logOp(
  opType: IasqlOperationType,
  dbProps: DbProps,
  eventProps: EventProps,
  uid: string,
) {
  await logEvent(opType, dbProps, eventProps, uid);
}

export async function logRpc(
  moduleName: string,
  methodName: string,
  dbProps: DbProps,
  eventProps: EventProps,
  uid: string,
) {
  await logEvent(`${moduleName}:${methodName}`, dbProps, eventProps, uid);
}

export default singleton;
