import EventEmitter from 'events';
import { run } from 'graphile-worker';

import * as iasql from '../services/iasql'
import * as logger from '../services/logger'
import { TypeormWrapper } from './typeorm';

const workerShutdownEmitter = new EventEmitter();

// graphile-worker here functions as a library, not a child process.
// It manages its own database schema
// (graphile_worker) and migrations in each user db using our credentials
export async function start(dbAlias: string, dbId:string, user: any) {
  // use the same connection for the scheduler and its operations
  const conn = await TypeormWrapper.createConn(dbId);
  const runner = await run({
    pgPool: conn.getMasterConnection(),
    concurrency: 5,
    // Install signal handlers for graceful shutdown on SIGINT, SIGTERM, etc
    noHandleSignals: false,
    pollInterval: 1000, // ms
    taskList: {
      scheduleApply: async () => {
        try {
          await iasql.apply(dbAlias, false, user, conn);
        } catch (e) {
          logger.error(e);
        }
      },
      scheduleSync: async () => {
        try {
          await iasql.sync(dbAlias, false, user, conn);
        } catch (e) {
          logger.error(e);
        }
      },
    },
  });
  runner.promise.catch((e) => {
    logger.error(e);
  });
  // register the shutdown listener
  workerShutdownEmitter.on(dbId, async () => {
    await runner.stop()
  });
  // deregister it when already stopped
  runner.events.on('stop', () => workerShutdownEmitter.removeAllListeners(dbId))
}

export function stop(dbId: string) {
  workerShutdownEmitter.emit(dbId);
}