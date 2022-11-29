import * as express from 'express';
import { expressjwt, GetVerificationKey } from 'express-jwt';
import jwksRsa from 'jwks-rsa';

import config from '../config';
// routes
import { db } from './db';

const v1 = express.Router();
// 10 GB post payload limit for import dumps
v1.use(express.json({ limit: '10000MB' }));
v1.use(express.text({ limit: '10000MB' }));
if (config.auth) {
  const checkJwt = expressjwt({
    secret: jwksRsa.expressJwtSecret({
      jwksUri: `${config.auth.domain}.well-known/jwks.json`,
    }) as GetVerificationKey, // https://github.com/auth0/express-jwt/issues/288
    audience: config.auth.audience,
    issuer: config.auth.domain,
    algorithms: ['RS256'],
  });
  v1.use(checkJwt);
}
// TODO secure with scope
v1.use('/db', db);
v1.get('/version/latest', (_req, res) => res.send(config.version));
v1.get('/version/oldest', (_req, res) => res.send(config.version));

export { v1 };
