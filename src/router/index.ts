import * as express from 'express'
import jwt from 'express-jwt'
import jwksRsa from 'jwks-rsa'

import config from '../config'

// routes
import { db, } from './db'
import { graphql, } from './graphql'

const v1 = express.Router();
// 10 GB post payload limit for import dumps
v1.use(express.json({ limit: '10000MB' }));
if (config.auth0) {
  const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
      jwksUri: `${config.auth0.domain}.well-known/jwks.json`,
    }),
    audience: config.auth0.audience,
    issuer: config.auth0.domain,
    algorithms: ['RS256'],
  });
  v1.use(checkJwt);
}
// TODO secure with scope
v1.use('/db', db)
if (config.graphql) v1.use('/graphql', graphql)

export { v1 };