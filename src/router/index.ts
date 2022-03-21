import * as express from 'express'
import jwt from 'express-jwt'
import jwksRsa from 'jwks-rsa'

import config from '../config'

// routes
import { db, } from './db'
import { mod, } from './module'

const v1 = express.Router();
// 10 GB post payload limit for import dumps
v1.use(express.json({ limit: '10000MB' }));
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
// TODO secure with scope
v1.use('/db', db)
v1.use('/module', mod)

export { v1 };