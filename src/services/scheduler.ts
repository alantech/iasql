import { run } from 'graphile-worker';

import * as dbMan from './db-manager'
import * as iasql from '../services/iasql'
import * as logger from '../services/logger'

// graphile-worker runs a worker by managing its own database schema 
// (graphile_worker) and migrations in each user db using our credentials
export async function start(dbAlias: string, user: any) {
  let dbId;
  try {
    const meta = await dbMan.getMetadata(dbAlias, user);
    dbId = meta.dbId;
  } catch (e: any) {
    throw e;
  }
  // Run a worker to execute jobs:
  const runner = await run({
    connectionString: dbMan.ourPgUrl(dbId),
    concurrency: 5,
    // Install signal handlers for graceful shutdown on SIGINT, SIGTERM, etc
    noHandleSignals: false,
    pollInterval: 1000, // ms
    taskList: {
      scheduleApply: async () => {
        try {
          await iasql.apply(dbAlias, false, user);
        } catch (e) {
          logger.error(e);
        }
      },
      scheduleSync: async () => {
        try {
          await iasql.sync(dbAlias, false, user);
        } catch (e) {
          logger.error(e);
        }
      },
    },
  });
}