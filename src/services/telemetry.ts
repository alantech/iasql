import * as Amplitude from '@amplitude/node';
import { Identify } from '@amplitude/identify';

import config from '../config';
import logger from '../services/logger'
import { IasqlOperationType } from '../modules/iasql_functions@0.0.1/entity';

const singleton = config.telemetry ? Amplitude.init(config.telemetry.amplitudeKey) : undefined;

export function logDbConnect(dbId: string, uid: string, email: string, directConnect: boolean) {
  logDbEvent(dbId, 'CONNECT', {
    directConnect
  });
  identifyDb(dbId, uid, email);
}

export function logDbDisconnect(dbId: string) {
  logDbEvent(dbId, 'DISCONNECT');
}

export function logDbExport(dbId: string, dataOnly: boolean) {
  logDbEvent(dbId, 'EXPORT', {
    dataOnly,
  });
}

export function logDbOp(dbId: string, opType: IasqlOperationType, eventProps: any) {
  logDbEvent(dbId, opType, eventProps);
}

function logDbEvent(dbId: string, eventType: string, eventProps?: any) {
  if (!singleton) return;
  try {
    singleton.logEvent({
      event_type: eventType,
      device_id: dbId,
      event_properties: eventProps,
    });
  } catch(e: any) {
    logger.error('failed to log db event', e);
  }
}

function identifyDb(dbId: string, uid: string, email: string) {
  if (!singleton) return;
  try {
    // https://developers.amplitude.com/docs/identify-api
    const ident = new Identify();
    ident.set('user_properties', {
      email,
    });
    singleton.identify(uid, dbId, ident);
  } catch(e: any) {
    logger.error('failed to identify user', e);
  }
}

export default singleton;