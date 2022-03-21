import EventEmitter from 'events';
import { run } from 'graphile-worker';

import { IasqlOperationType } from '../entity/operation';
import * as iasql from '../services/iasql'
import * as logger from '../services/logger'
import { TypeormWrapper } from './typeorm';

const workerShutdownEmitter = new EventEmitter();

// graphile-worker here functions as a library, not a child process.
// It manages its own database schema
// (graphile_worker) and migrations in each uid db using our credentials
export async function start(dbAlias: string, dbId:string, uid: string) {
  // use the same connection for the scheduler and its operations
  const conn = await TypeormWrapper.createConn(dbId);
  const runner = await run({
    pgPool: conn.getMasterConnection(),
    concurrency: 5,
    // Install signal handlers for graceful shutdown on SIGINT, SIGTERM, etc
    noHandleSignals: false,
    pollInterval: 1000, // ms
    taskList: {
      operation: async (payload: any) => {
        const { params, opid, optype } = payload;
        let promise;
        switch(optype) {
          case IasqlOperationType.APPLY: {
            promise = iasql.apply(dbAlias, false, uid, conn);
            break;
          }
          case IasqlOperationType.PLAN: {
            promise = iasql.apply(dbAlias, true, uid, conn);
            break;
          }
          case IasqlOperationType.SYNC: {
            promise = iasql.sync(dbAlias, false, uid, conn);
            break;
          }
          case IasqlOperationType.INSTALL: {
            promise = iasql.install(params, dbAlias, uid, false, conn);
            break;
          }
          case IasqlOperationType.UNINSTALL: {
            promise = iasql.uninstall(params, dbAlias, uid, conn);
            break;
          }
          default: {
            break;
          }
        }
        // once the operation completes updating the `end_date`
        // will complete the polling
        try {
          let output = await promise;
          output = typeof output === 'string' ? output : JSON.stringify(output);
          await conn.query(`
            update iasql_operation
            set end_date = now(), output = '${output}'
            where opid = '${opid}';`
          );
        } catch (e) {
          const error = JSON.stringify(e, Object.getOwnPropertyNames(e));
          await conn.query(`
            update iasql_operation
            set end_date = now(), err = '${error}'
            where opid = '${opid}';`
          );
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