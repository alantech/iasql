import * as Amplitude from '@amplitude/node';

import config from '../config';
import logger from './logger';
import { IasqlOperationType } from '../modules/0.0.1/iasql_functions/entity';

const singleton = config.telemetry ? Amplitude.init(config.telemetry.amplitudeKey) : undefined;

export async function logDbConnect(dbId: string, dbAlias: string, uid: string, email: string, directConnect: boolean) {
  if (!singleton) return;
  try {
    await singleton.logEvent({
      event_type: 'CONNECT',
      // a user can have multiple devices in amplitude
      // so we map a database to a device
      device_id: dbId,
      user_id: uid,
      user_properties: {
        email,
      },
      device_model: dbAlias,
      event_properties: {
        directConnect
      },
    });
  } catch(e: any) {
    logger.error('failed to log CONNECT event', e);
  }
}

export async function logUserRegister(uid: string, email: string) {
  if (!singleton) return;
  try {
    await singleton.logEvent({
      user_id: uid,
      event_type: 'REGISTER',
      user_properties: {
        email,
      },
    });
  } catch(e: any) {
    logger.error('failed to log REGISTER event', e);
  }
}

export async function logDbDisconnect(dbId: string) {
  await logDbEvent(dbId, 'DISCONNECT');
}

export async function logDbExport(dbId: string, dataOnly: boolean) {
  await logDbEvent(dbId, 'EXPORT', {
    dataOnly,
  });
}

export async function logDbOp(dbId: string, opType: IasqlOperationType, eventProps: any) {
  await logDbEvent(dbId, opType, eventProps);
}

async function logDbEvent(dbId: string, eventType: string, eventProps?: any) {
  if (!singleton) return;
  try {
    singleton.logEvent({
      event_type: eventType,
      device_id: dbId,
      event_properties: eventProps,
    });
  } catch(e: any) {
    logger.error(`failed to log ${eventType} event`, e);
  }
}

export default singleton;