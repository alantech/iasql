import * as sentry from '@sentry/node'
import { Logger, LogFunctionFactory } from 'graphile-worker';

import config from '../config';

const logFactory: LogFunctionFactory = (scope) => {
  return (level, message, meta) => {
    switch (level) {
      case 'debug':
        if (!config.debugLogger) return;
        return console.log(level, message, scope, meta);
      case 'error':
        return console.error(level, message, scope, meta);
      default:
        return console.log(level, message, scope, meta);
    }
  };
}
const singleton = new Logger(logFactory);

export function debugObj(e: any) {
  if (config.debugLogger) console.dir(e, { depth: 6 });
}

// this function should only be used in the catch statement of the routes and scheduler
// everywhere else `throw` the error upstream
// TODO is there a way to DRY that?
// returns the sentry error id
export function logUserErr(e: any): string {
  let err = e?.message ?? '';
  let errStack = err;
  if (e.metadata?.failures) {
    err = e.metadata.failures.map((f: Error) => f?.message).join('\n');
    errStack = e.metadata.failures.map((f: Error) => f?.stack ?? f?.message).join('\n');
  }
  if (config.sentryEnabled) err += `\nPlease provide the following error ID if reporting it to the IaSQL team: ${sentry.captureException(errStack)}`;
  singleton.error(err);
  return err;
}

function exposeErrorProperties(error: Error) {
  const copy = Object.assign({}, error);
  if (error.name) copy.name = error.name;
  if (error.message) copy.message = error.message;
  if (error.stack) copy.stack = error.stack;
  return copy;
}

export function errorReplacer(_key: string, value: any) {
  if (value instanceof Error) {
    return exposeErrorProperties(value);
  } else if (Array.isArray(value)) {
    return value.map(val => JSON.stringify(val, errorReplacer))
  } else {
    return value;
  }
}

export default singleton;