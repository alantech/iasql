import * as Amplitude from '@amplitude/node'

import config, { ENV } from '../config'
import logger from './logger'
import { latest, } from '../modules'

// Weird little dance to make it a type again.
// From: https://www.typescriptlang.org/docs/handbook/enums.html#objects-vs-enums
const { IasqlOperationType, } = latest.IasqlFunctions.utils;
type IasqlOperationType = typeof IasqlOperationType[keyof typeof IasqlOperationType];

const singleton = config.telemetry ? Amplitude.init(config.telemetry.amplitudeKey) : undefined;

export async function logDbConnect(dbId: string, userProps: any) {
  if (!singleton) return;
  try {
    await singleton.logEvent({
      event_type: 'CONNECT',
      // a user maps to database
      user_id: dbId,
      user_properties: {
        env: ENV,
        ...userProps
      },
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
        env: ENV,
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

export async function logUserRegister(uid: string, email: string) {
  if (!singleton) return;
  try {
    await singleton.logEvent({
      user_id: uid,
      event_type: 'REGISTER',
      user_properties: {
        email,
        env: ENV,
      },
    });
  } catch(e: any) {
    logger.error('failed to log REGISTER event', e);
  }
}

export async function logDbDisconnect(dbId: string) {
  await logDbEvent(dbId, {}, 'DISCONNECT');
}

export async function logDbExport(dbId: string, dataOnly: boolean) {
  await logDbEvent(dbId, {}, 'EXPORT', {
    dataOnly,
  });
}

export async function logDbOp(dbId: string, userProps: any, opType: IasqlOperationType, eventProps: any) {
  await logDbEvent(dbId, userProps, opType, eventProps);
}

async function logDbEvent(dbId: string, userProps: any, eventType: string, eventProps?: any) {
  if (!singleton) return;
  try {
    singleton.logEvent({
      event_type: eventType,
      user_id: dbId,
      event_properties: eventProps,
      user_properties: {
        env: ENV,
        ...userProps
      },
    });
  } catch(e: any) {
    logger.error(`failed to log ${eventType} event`, e);
  }
}

export default singleton;