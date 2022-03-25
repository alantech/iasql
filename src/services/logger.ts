import * as sentry from '@sentry/node'

import config from '../config';

// TODO implement the rest

// this function should only be used in the catch statement of the routes and scheduler
// everywhere else `throw` the error upstream
// TODO is there a way to DRY that?
// returns the sentry error id
export function error(e: any): string {
  let err = e?.message ?? '';
  let errStack = err;
  if (e.metadata?.failures) {
    err = e.metadata.failures.map((f: Error) => f?.message).join('\n');
    errStack = e.metadata.failures.map((f: Error) => f?.stack ?? f?.message).join('\n');
  }
  if (config.sentryEnabled) err += `\nPlease provide the following error ID if reporting it to the IaSQL team: ${sentry.captureException(errStack)}`;
  console.error(err);
  return err;
}