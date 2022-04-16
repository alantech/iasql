import * as Amplitude from '@amplitude/node';
import { Identify } from '@amplitude/identify';

import config from '../config';
import { IasqlOperationType } from '../modules/iasql_functions@0.0.1/entity';

const singleton = config.telemetry ? Amplitude.init(config.telemetry.amplitudeKey) : undefined;


export function logDbConnect(dbId: string, dbAlias: string, uid: string, email: string, directConnect: boolean) {
  if (!singleton) return;
  // https://developers.amplitude.com/docs/identify-api
  const ident = new Identify();
  ident.set('user_properties', {
    email,
  });
  // identify device id with user id before logging event
  singleton.identify(uid, dbId, ident);
  singleton.logEvent({
    event_type: 'CONNECT',
    // a user can have multiple devices in amplitude
    // so we map a database to a device
    device_id: dbId,
    device_model: dbAlias,
    event_properties: {
      directConnect
    },
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