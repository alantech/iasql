import * as express from 'express'
import { postgraphile, } from 'postgraphile'

import * as dbMan from '../services/db-manager';
import config from '../config'
import metadata from '../services/repositories/metadata'

export const graphql = express.Router();

if (config.graphql) {
  const withGraphiql = config.graphql.withGraphiql;
  // Lookup table of connected postgraphile instances per database, also keeping track of the last
  // access times.
  const postgraphiles: { [key: string]: { lastAccessMs: number, graphile: any, }, } = {};
  // Every 30 seconds, check if any of the postgraphiles have not been used in the past 10 minutes
  // and cleanly shut them down and remove them from the listing
  setInterval(() => {
    const checkTimeMs = Date.now();
    Object.keys(postgraphiles).forEach((db) => {
      if (checkTimeMs - postgraphiles[db].lastAccessMs > 10 * 60 * 1000) {
        postgraphiles[db].graphile.release();
        delete postgraphiles[db];
      }
    });
  }, 30 * 1000);
  // For a given DB name, either acquire the postgraphile middleware that already exists or create a
  // new one. No matter what, set the last access time to now so it is not terminated.
  const getPostgraphile = (db: string) => {
    try {
      postgraphiles[db] = postgraphiles[db] ?? {
        lastAccessMs: Date.now(),
        graphile: postgraphile(
          `postgresql://${config.db.user}:${config.db.password}@${config.db.host}/${db}${config.db.forceSSL ? '?sslmode=no-verify' : ''}`,
          'public',
          {
            externalUrlBase: `/v1/graphql/${db}`,
            graphiql: withGraphiql,
            watchPg: true,
          }),
      };
    } catch(e) {
      // If postgraphile fails during construction, that error could crash the server. Instead
      // we pass back an Express middleware that always fails
      postgraphiles[db] = {
        lastAccessMs: Date.now(),
        graphile: (_req: any, _res: any, next: any) => next(new Error(`${db} does not exist`)),
      };
    }
    postgraphiles[db].lastAccessMs = Date.now();
    return postgraphiles[db].graphile;
  };

  graphql.use('/:db', async (req, res, next) => {
    const db = config.auth ?
      // This will throw an error if the user is not allowed to access the specified DB
      (await metadata.getDb(dbMan.getUid(req.user), req.params.db)).pgName :
      req.params.db;
    getPostgraphile(db)(req, res, next);
  });
}
