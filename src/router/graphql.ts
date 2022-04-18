import * as express from 'express'
import { postgraphile, } from 'postgraphile'

import * as dbMan from '../services/db-manager';
import config from '../config'
import metadata from '../services/repositories/metadata'

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

  graphql.use('/:db', async (req, res, next) => {
    const db = config.auth ?
      // This will throw an error if the user is not allowed to access the specified DB
      (await metadata.getDb(dbMan.getUid(req.user), req.params.db)).pgName :
      req.params.db;
    getPostgraphile(db)(req, res, next);
  });
}
