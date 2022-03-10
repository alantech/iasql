import * as express from 'express'
import jwt from 'express-jwt'
import jwksRsa from 'jwks-rsa'
import * as semver from 'semver';
import * as sentry from '@sentry/node'

import { db, } from './db'
import config from '../config'
import { mod, } from './module'

export function handleErrorMessage(e: any): string {
  let err = e?.message ?? '';
  let errStack = err;
  if (e.metadata?.failures) {
    err = e.metadata.failures.map((f: Error) => f?.message).join('\n');
    errStack = e.metadata.failures.map((f: Error) => f?.stack ?? f?.message).join('\n');
  }
  if (config.sentryEnabled) err += `\nPlease provide the following error ID if reporting it to the IaSQL team: ${sentry.captureException(errStack)}`;
  return err;
}

export const MIN_CLI_VERSION = '0.2.5';

const v1 = express.Router();
// 10 GB post payload limit for import dumps
v1.use(express.json({ limit: '10000MB' }));
// check the user is on a minimum CLI version
v1.use((req, res, next) => {
  const headers = req.headers;
  const cliVersion = headers["cli-version"] as string;
  if (!cliVersion || semver.compare(MIN_CLI_VERSION, cliVersion) > 0) {
    const error = {
      message: `Outdated CLI version. Must use version ${MIN_CLI_VERSION} at least. Please refer to https://docs.iasql.com/install to upgrade.`
    };
    return res.status(500).end(
      `${handleErrorMessage(error)}`
    );
  }
  next();
});
if (config.a0Enabled) {
  const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
      jwksUri: `${config.a0Domain}.well-known/jwks.json`,
    }),
    audience: config.a0Audience,
    issuer: config.a0Domain,
    algorithms: ['RS256'],
  });
  v1.use(checkJwt);
}

// TODO secure with cors and scope
v1.use('/db', db)
v1.use('/module', mod)

export { v1 };