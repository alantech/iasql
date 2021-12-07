import * as express from 'express'
import jwt from 'express-jwt'
import jwksRsa from 'jwks-rsa'

import { db, } from './db'
import config from '../config'
import { mod, } from './module'

export function handleErrorMessage(e: any): string {
  let err = e?.message ?? '';
  if (e.metadata?.failures) {
    err = e.metadata.failures.map((f: Error) => f?.message).join('\n');
  }
  return err;
}

const v1 = express.Router();
v1.use(express.json());

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

v1.use('/db', db)
v1.use('/module', mod)

export { v1 };