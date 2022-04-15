import * as express from 'express'
import { postgraphile, } from 'postgraphile'

import config from '../config'

export const graphql = express.Router();

if (config.graphql) {
  const withGraphiql = config.graphql.withGraphiql;
  // TODO: Turn this into an expiring map when activity is low
  const postgraphiles: { [key: string]: any, } = {};

  const getPostgraphile = (db: string) => {
    postgraphiles[db] = postgraphiles[db] ?? postgraphile(
      `postgresql://${config.db.user}:${config.db.password}@${config.db.host}/${db}${config.db.forceSSL ? '?sslmode=require' : ''}`,
      'public',
      {
        externalUrlBase: `/v1/graphql/${db}`,
        graphiql: withGraphiql,
      });
    return postgraphiles[db];
  };

  graphql.use('/:db', (req, res, next) => getPostgraphile(req.params.db)(req, res, next));
}
