import EventEmitter from 'events';
import { run } from 'graphile-worker';

import * as dbMan from './db-manager'
import * as iasql from '../services/iasql'
import * as logger from '../services/logger'

const workerShutdownEmitter = new EventEmitter();

// graphile-worker here functions as a library, not a child process.
// It manages its own database schema
// (graphile_worker) and migrations in each user db using our credentials
export async function start(dbAlias: string, dbId: string, user: any) {
  // Run a worker to execute jobs:
  const runner = await run({
    // TODO pass a connection pool here instead of telling it to create a new one
    connectionString: dbMan.ourPgUrl(dbId),
    concurrency: 5,
    // Install signal handlers for graceful shutdown on SIGINT, SIGTERM, etc
    noHandleSignals: false,
    pollInterval: 1000, // ms
    taskList: {
      // TODO use the connection pool from the schedule instead of creating yet another new one?
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
  // register the shutdown listener
  workerShutdownEmitter.on(dbId, async () => {
    await runner.stop()
  });
}

export function stop(dbId: string) {
  workerShutdownEmitter.emit(dbId);
}