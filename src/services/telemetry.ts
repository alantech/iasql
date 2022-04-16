import * as Amplitude from '@amplitude/node';

import config from '../config';
import { IasqlOperationType } from '../modules/iasql_functions@0.0.1/entity';

const singleton = config.telemetry ? Amplitude.init(config.telemetry.amplitudeKey) : undefined;

export function logDbConnect(dbId: string, dbAlias: string, uid: string, email: string, directConnect: boolean) {
  if (!singleton) return;
  singleton.logEvent({
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
}

export function logDbList(uid: string, dbCount: number, totalRecordCount: number) {
  if (!singleton) return;
  singleton.logEvent({
    user_id: uid,
    event_type: 'LIST',
    event_properties: {
      dbCount,
      totalRecordCount,
    }
  });
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
  singleton.logEvent({
    event_type: eventType,
    device_id: dbId,
    event_properties: eventProps,
  });
}

export default singleton;