import * as Amplitude from '@amplitude/node'

import config, { IASQL_ENV } from '../config'
import logger from './logger'
import { latest, } from '../modules'

// Weird little dance to make it a type again.
// From: https://www.typescriptlang.org/docs/handbook/enums.html#objects-vs-enums
const { IasqlOperationType, } = latest.IasqlFunctions.utils;
type IasqlOperationType = typeof IasqlOperationType[keyof typeof IasqlOperationType];

const singleton = config.telemetry ? Amplitude.init(config.telemetry.amplitudeKey) : undefined;

export type UserProps = {
  dbAlias?: string
  uid?: string
  iasqlEnv?: string
  recordCount?: number
  operationCount?: number
  email?: string
}

export async function logDbConnect(dbId: string, userProps: UserProps) {
  if (!singleton) return;
  try {
    userProps.iasqlEnv = IASQL_ENV;
    await singleton.logEvent({
      event_type: 'CONNECT',
      // a user maps to database
      user_id: dbId,
      user_properties: userProps,
    });
  } catch(e: any) {
    logger.error('failed to log CONNECT event', e);
  }
}

async function logDbErr(event: string, uid: string, email: string, error: string, dbId?: string) {
  if (!singleton) return;
  try {
    await singleton.logEvent({
      event_type: event,
      user_id: dbId,
      user_properties: {
        email,
        uid,
        iasqlEnv: IASQL_ENV,
      },
      event_properties: {
        error,
      }
    });
  } catch(e: any) {
    logger.error(`failed to log ${event} event`, e);
  }
}

export async function logDbDisconnectErr(uid: string, email: string, error: string) {
  await logDbErr('DISCONNECT', uid, email, error);
}

export async function logDbConnectErr(dbId: string, uid: string, email: string, error: string) {
  await logDbErr('CONNECT', dbId, uid, email, error);
}

export async function logDbDisconnect(dbId: string, userProp: UserProps) {
  await logDbEvent(dbId, userProp, 'DISCONNECT');
}

export async function logDbExport(dbId: string, userProp: UserProps, dataOnly: boolean) {
  await logDbEvent(dbId, userProp, 'EXPORT', {
    dataOnly,
  });
}

export async function logDbOp(dbId: string, userProps: UserProps, opType: IasqlOperationType, eventProps: any) {
  await logDbEvent(dbId, userProps, opType, eventProps);
}

async function logDbEvent(dbId: string, userProps: UserProps, eventType: string, eventProps?: any) {
  if (!singleton) return;
  try {
    userProps.iasqlEnv = IASQL_ENV;
    singleton.logEvent({
      event_type: eventType,
      user_id: dbId,
      event_properties: eventProps,
      user_properties: userProps,
    });
  } catch(e: any) {
    logger.error(`failed to log ${eventType} event`, e);
  }
}

export default singleton;