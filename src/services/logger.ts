import * as util from 'util'

import * as sentry from '@sentry/node'
import { Logger, LogFunctionFactory } from 'graphile-worker'

import config from '../config'

const logFactory: LogFunctionFactory = (scope) => {
  // Better to check the config once in the factory and return fixed functions instead of checking
  // on each log output
  if (config.debugLogger && config.testLogger) {
    return (level, message, meta) => {
      const str = `${level}: ${message} ${util.inspect(scope)}${meta ? ` ${util.inspect(meta, { depth: 6, })}` : ''}\n`;
      switch (level) {
        case 'error':
          process.stderr.write(str);
          break;
        case 'debug':
        default:
          process.stdout.write(str);
          break;
      }
    };
  } else if (config.debugLogger) {
    return (level, message, meta) => {
      switch (level) {
        case 'error':
          console.error(level, message, scope, meta);
          break;
        case 'debug':
        default:
          console.log(level, message, scope, meta);
          break;
      }
    };
  } else if (config.testLogger) {
    return (level, message, meta) => {
      const str = `${level}: ${message} ${util.inspect(scope)}${meta ? ` ${util.inspect(meta, { depth: 6, })}` : ''}\n`;
      switch (level) {
        case 'error':
          process.stderr.write(str);
          break;
        default:
          process.stdout.write(str);
          break;
      }
    };
  } else {
    return (level, message, meta) => {
      switch (level) {
        case 'error':
          console.error(level, message, scope, meta);
          break;
        default:
          console.log(level, message, scope, meta);
          break;
      }
    };
  }
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

export default singleton;