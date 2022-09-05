import * as sentry from '@sentry/node';
import express from 'express';
import { run } from 'graphile-worker';
import { v4 as uuidv4 } from 'uuid';

import config from '../config';
import { throwError } from '../config/config';
import { IasqlDatabase } from '../entity';
import { modules } from '../modules';
import * as iasql from './iasql';
import logger, { logErrSentry } from './logger';
import MetadataRepo from './repositories/metadata';
import * as telemetry from './telemetry';
import { TypeormWrapper } from './typeorm';

const latest = modules[config.modules.latestVersion];

const IasqlOperationType =
  latest?.IasqlFunctions?.utils?.IasqlOperationType ??
  latest?.iasqlFunctions?.iasqlOperationType ??
  throwError('Core IasqlFunctions not found');

const workerRunners: { [key: string]: { runner: any; conn: any } } = {}; // TODO: What is the runner type?

// graphile-worker here functions as a library, not a child process.
// It manages its own database schema
// (graphile_worker) and migrations in each uid db using our credentials
export async function start(db: IasqlDatabase) {
  const { pgName: dbId, pgUser: dbUser } = db;
  // use the same connection for the scheduler and its operations
  const conn = await TypeormWrapper.createConn(dbId, { name: uuidv4() });
  // create a dblink server per db to reduce connections when calling dblink in iasql op SP
  // https://aws.amazon.com/blogs/database/migrating-oracle-autonomous-transactions-to-postgresql/
  await conn.query(`CREATE EXTENSION IF NOT EXISTS dblink;`);
  await conn.query(
    `CREATE SERVER IF NOT EXISTS loopback_dblink_${dbId} FOREIGN DATA WRAPPER dblink_fdw OPTIONS (host '${config.db.host}', dbname '${dbId}', port '${config.db.port}');`,
  );
  await conn.query(
    `CREATE USER MAPPING IF NOT EXISTS FOR ${config.db.user} SERVER loopback_dblink_${dbId} OPTIONS (user '${config.db.user}', password '${config.db.password}')`,
  );
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
        switch (optype) {
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
        const user = db?.iasqlUsers?.[0];
        const uid = user?.id;
        const email = user?.email;
        const dbAlias = db?.alias;
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
          error = errorStringify.replace(/[\']/g, '\\"');
          const query = `
            update iasql_operation
            set end_date = now(), err = '${error}'
            where opid = uuid('${opid}');
          `;
          await conn.query(query);
        } finally {
          try {
            const recordCount = await iasql.getDbRecCount(conn);
            const operationCount = await iasql.getOpCount(conn);
            await MetadataRepo.updateDbCounts(dbId, recordCount, operationCount);
            // list is called by us and has no dbAlias so ignore
            if (uid && optype !== IasqlOperationType.LIST)
              telemetry.logOp(
                optype,
                {
                  dbId,
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
                uid,
              );
          } catch (e: any) {
            logger.error('could not log op event', e);
          }
        }
      },
    },
  });
  workerRunners[dbId] = { runner, conn };
}

export async function stop(db: IasqlDatabase) {
  const dbId = db.pgName;
  const { runner, conn } = workerRunners[dbId] ?? { runner: undefined, conn: undefined };
  if (runner && conn) {
    try {
      await runner.stop();
    } catch (e) {
      const user = db.iasqlUsers?.[0];
      logErrSentry(e, user?.id, user?.email, db.alias);
      logger.warn(
        `Graphile workers for ${dbId} has already been stopped. Perhaps Kubernetes is going to restart the process?`,
        { e },
      );
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
    await stop(db);
  }
}

// spin up a worker for every db that this server is already managing
export async function init() {
  // Necessary in the child process
  if (config.sentry) sentry.init(config.sentry);
  if (!MetadataRepo.initialized) await MetadataRepo.init();
  const dbs: IasqlDatabase[] = (
    await Promise.all(
      (
        await MetadataRepo.getAllDbs()
      ).map(async db => {
        const versionString = await TypeormWrapper.getVersionString(db.pgName);
        const Modules = (modules as any)[versionString];
        return !!Modules ? db : undefined;
      }),
    )
  ).filter((db: IasqlDatabase | undefined) => db !== undefined) as IasqlDatabase[]; // Typescript should know better
  const inits = await Promise.allSettled(dbs.map(db => start(db)));
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

if (require.main === module) {
  const app = express();
  const port = 14527;

  function respondErrorAndDie(res: any, err: any, db?: IasqlDatabase) {
    let errorResponse;
    if (db) {
      const user = db.iasqlUsers?.[0];
      errorResponse = logErrSentry(err, user?.id, user?.email, db.alias);
    } else {
      errorResponse = logErrSentry(err);
    }
    if (res) res.status(500).send(errorResponse);
    logger.error(`Scheduler exited with error: ${err}`);
    process.exit(13);
  }

  app.use((req: any, res: any, next: any) => {
    logger.info(`Scheduler called on ${req.url}`);
    next();
  });

  app.get('/start/:dbId/', async (req: any, res: any) => {
    const { dbId } = req.params;
    const db = await MetadataRepo.getDbById(dbId);
    if (!db) return respondErrorAndDie(res, new Error('dbId not found!'));

    start(db)
      .then(() => res.sendStatus(200))
      .catch(e => respondErrorAndDie(res, e, db));
  });

  app.get('/stop/:dbId/', async (req: any, res: any) => {
    const { dbId } = req.params;
    const db = await MetadataRepo.getDbById(dbId);
    if (!db) return respondErrorAndDie(res, new Error('dbId not found!'));

    stop(db)
      .then(() => res.sendStatus(200))
      .catch(e => respondErrorAndDie(res, e, db));
  });

  app.get('/stopAll/', (req: any, res: any) => {
    stopAll()
      .then(() => res.sendStatus(200))
      .catch(e => respondErrorAndDie(res, e));
  });

  app.head('/health/', (req: any, res: any) => {
    res.sendStatus(200);
  });

  init()
    .then(() => {
      app.listen(port, () => {
        logger.info(`Scheduler running on port ${port}`);
      });
    })
    .catch(e => respondErrorAndDie(undefined, e));
}
