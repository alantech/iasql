import { run } from 'graphile-worker'
import * as sentry from '@sentry/node';
import { v4 as uuidv4, } from 'uuid'

import { latest, } from '../modules'
import MetadataRepo from './repositories/metadata'
import * as iasql from './iasql'
import * as telemetry from './telemetry'
import logger, { logErrSentry } from './logger'
import { TypeormWrapper } from './typeorm'
import { IasqlDatabase } from '../entity'
import config from '../config'

const { IasqlOperationType, } = latest.IasqlFunctions.utils;

const workerRunners: { [key: string]: { runner: any, conn: any}, } = {}; // TODO: What is the runner type?

// graphile-worker here functions as a library, not a child process.
// It manages its own database schema
// (graphile_worker) and migrations in each uid db using our credentials
export async function start(dbId: string, dbUser:string) {
  // use the same connection for the scheduler and its operations
  const conn = await TypeormWrapper.createConn(dbId, { name: uuidv4(), });
  // create a dblink server per db to reduce connections when calling dblink in iasql op SP
  // https://aws.amazon.com/blogs/database/migrating-oracle-autonomous-transactions-to-postgresql/
  await conn.query(`CREATE EXTENSION IF NOT EXISTS dblink;`);
  await conn.query(`CREATE SERVER IF NOT EXISTS loopback_dblink_${dbId} FOREIGN DATA WRAPPER dblink_fdw OPTIONS (host '${config.db.host}', dbname '${dbId}', port '${config.db.port}');`);
  await conn.query(`CREATE USER MAPPING IF NOT EXISTS FOR ${config.db.user} SERVER loopback_dblink_${dbId} OPTIONS (user '${config.db.user}', password '${config.db.password}')`);
  const runner = await run({
    pgPool: conn.getMasterConnection(),
    concurrency: 1,
    logger,
    // Install signal handlers for graceful shutdown on SIGINT, SIGTERM, etc
    noHandleSignals: false,
    pollInterval: 1000, // ms
    taskList: {
      operation: async (payload: any) => {
        const { params, opid, optype } = payload;
        let promise;
        switch(optype) {
          case IasqlOperationType.APPLY: {
            promise = iasql.apply(dbId, false);
            break;
          }
          case IasqlOperationType.PLAN_APPLY: {
            promise = iasql.apply(dbId, true);
            break;
          }
          case IasqlOperationType.SYNC: {
            promise = iasql.sync(dbId, false);
            break;
          }
          case IasqlOperationType.PLAN_SYNC: {
            promise = iasql.sync(dbId, true);
            break;
          }
          case IasqlOperationType.INSTALL: {
            promise = iasql.install(params, dbId, dbUser, false);
            break;
          }
          case IasqlOperationType.UNINSTALL: {
            promise = iasql.uninstall(params, dbId);
            break;
          }
          case IasqlOperationType.LIST: {
            promise = iasql.modules(true, false, dbId);
            break;
          }
          case IasqlOperationType.UPGRADE: {
            promise = iasql.upgrade(dbId, dbUser);
            break;
          }
          default: {
            break;
          }
        }
        let output;
        let error;
        const user = await MetadataRepo.getUserFromDbId(dbId);
        const uid = user?.id;
        const email = user?.email;
        const dbAlias = user?.iasqlDatabases?.[0]?.alias;
        try {
          output = await promise;
          // once the operation completes updating the `end_date`
          // will complete the polling
          const query = `
            update iasql_operation
            set end_date = now(), output = '${output}'
            where opid = uuid('${opid}');
          `;
          logger.debug(query);
          output = typeof output === 'string' ? output : JSON.stringify(output);
          await conn.query(query);
        } catch (e) {
          let errorMessage: string | string[] = logErrSentry(e, uid, email, dbAlias);
          // split message if multiple lines in it
          if (errorMessage.includes('\n')) errorMessage = errorMessage.split('\n');
          // error must be valid JSON as a string
          const errorStringify = JSON.stringify({ message: errorMessage });
          // replace single quotes to make it valid
          error = errorStringify.replace(/[\']/g, "\\\"");
          const query = `
            update iasql_operation
            set end_date = now(), err = '${error}'
            where opid = uuid('${opid}');
          `
          await conn.query(query);
        } finally {
          try {
            const recordCount = await iasql.getDbRecCount(conn);
            const operationCount = await iasql.getOpCount(conn);
            await MetadataRepo.updateDbCounts(dbId, recordCount, operationCount);
            telemetry.logOp(
              optype,
              {
                uid,
                email,
                dbAlias,
                recordCount,
                operationCount,
              },
              {
                params,
                output,
                error,
              },
              dbId,
            );
          } catch(e: any) {
            logger.error('could not log op event', e);
          }
        }
      },
    },
  });
  workerRunners[dbId] = { runner, conn, };
}

export async function stop(dbId: string) {
  const { runner, conn, } = workerRunners[dbId] ?? { runner: undefined, conn: undefined, };
  if (runner && conn) {
    try {
      await runner.stop();
    } catch (e) {
      logger.warn(`Graphile workers for ${dbId} has already been stopped. Perhaps Kubernetes is going to restart the process?`, { e, });
    }
    await conn.query(`DROP SERVER IF EXISTS loopback_dblink_${dbId} CASCADE`);
    await conn.dropConn();
    delete workerRunners[dbId];
  } else {
    logger.warn(`Graphile worker for ${dbId} not found`);
  }
}

export async function stopAll() {
  const dbs: IasqlDatabase[] = await MetadataRepo.getAllDbs();
  for (const db of dbs) {
    await stop(db.pgName);
  }
}

// spin up a worker for every db that this server is already managing
export async function init() {
  // Necessary in the child process
  if (config.sentry) sentry.init(config.sentry);
  if (!MetadataRepo.initialized) await MetadataRepo.init();
  const dbs: IasqlDatabase[] = await MetadataRepo.getAllDbs();
  const inits = await Promise.allSettled(dbs.map(db => start(db.pgName, db.pgUser)));
  for (const [i, bootstrap] of inits.entries()) {
    if (bootstrap.status === 'rejected') {
      const db = dbs[i];
      const user = await MetadataRepo.getUserFromDbId(db.pgName);
      const message = `Failed to bootstrap db ${db.pgName} on startup. Reason: ${bootstrap.reason}`;
      logger.error(message);
      logErrSentry(new Error(message), user?.id, user?.email, db.alias);
    }
  }
}

// Primitive RPC between parent and child process. Requires the parent to produce a unique ID per
// request to pair up to the correct response. May replace with a revived multitransport-jsonrpc?
process.on('message', (m: string[]) => {
  const [fn, ...args] = m;
  switch (fn) {
    case 'init':
      init()
        .then(() => process.send?.(['initComplete', ...args, undefined]))
        .catch((e) => process.send?.(['initComplete', ...args, e.message]));
      break;
    case 'start':
      start(args[0], args[1])
        .then(() => process.send?.(['startComplete', ...args, undefined]))
        .catch((e) => process.send?.(['startComplete', ...args, e.message]));
      break;
    case 'stop':
      stop(args[0])
        .then(() => process.send?.(['stopComplete', ...args, undefined]))
        .catch((e) => process.send?.(['stopComplete', ...args, e.message]));
      break;
    case 'stopAll':
      stopAll()
        .then(() => process.send?.(['stopAllComplete', ...args, undefined]))
        .catch((e) => process.send?.(['stopAllComplete', ...args, e.message]));
      break;
  }
});