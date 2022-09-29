import * as sentry from '@sentry/node';
import express from 'express';
import { run } from 'graphile-worker';
import { default as cloneDeep } from 'lodash.clonedeep';
import { camelCase } from 'typeorm/util/StringUtils';
import { v4 as uuidv4 } from 'uuid';

import config from '../config';
import { throwError } from '../config/config';
import { IasqlDatabase } from '../entity';
import { Context, ModuleInterface, modules } from '../modules';
import { isString } from './common';
import * as iasql from './iasql';
import logger, { logErrSentry } from './logger';
import MetadataRepo from './repositories/metadata';
import * as telemetry from './telemetry';
import { TypeormWrapper } from './typeorm';

// ! DEPRECATED
// TODO: REMOVE BY THE TIME 0.0.20 BECOMES UNSUPPORTED
enum IasqlOperationType {
  APPLY = 'APPLY',
  SYNC = 'SYNC',
  INSTALL = 'INSTALL',
  UNINSTALL = 'UNINSTALL',
  PLAN_APPLY = 'PLAN_APPLY',
  PLAN_SYNC = 'PLAN_SYNC',
  LIST = 'LIST',
  UPGRADE = 'UPGRADE',
}

const workerRunners: { [key: string]: { runner: any; conn: any } } = {}; // TODO: What is the runner type?

// graphile-worker here functions as a library, not a child process.
// It manages its own database schema
// (graphile_worker) and migrations in each uid db using our credentials
export async function start(dbId: string, dbUser: string) {
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
      // ! DEPRECATED
      // TODO: REMOVE BY THE TIME 0.0.20 BECOMES UNSUPPORTED
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
          output = isString(output) ? output : JSON.stringify(output);
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
      rpc: async (payload: any) => {
        const { params, opid, modulename, methodname } = payload;
        let output: string | undefined;
        let error;
        const user = await MetadataRepo.getUserFromDbId(dbId);
        const uid = user?.id;
        const email = user?.email;
        const dbAlias = user?.iasqlDatabases?.[0]?.alias;
        const db = await MetadataRepo.getDbById(dbId);
        logger.info(`+-+ db ${db?.alias} upgrading ${db?.upgrading}`)
        if (db?.upgrading) {
          logger.info(`+-+ if upgrading thorw error`)
          throwError(`Database ${dbId} is upgrading.`);
        }
        logger.info(`+-+ somehow db ${db?.alias} upgrading ${db?.upgrading} continue executing`)
        try {
          const versionString = await TypeormWrapper.getVersionString(dbId);
          const Modules = (modules as any)[versionString];
          if (!Modules) {
            throwError(`Unsupported version ${versionString}. Please upgrade or replace this database.`);
          }
          // `Modules` is an object where the keys are all the exported elements from the modules dir
          // Classes are exported with PascalCase
          // Instantiated objects are exported with camelCase. We are interested in this objects.
          // `modulename` is arriving with snake_case since is how the module defines it based on the dirname
          const moduleName = Object.keys(Modules ?? {}).find(k => k === camelCase(modulename)) ?? 'unknown';
          if (!Modules[moduleName]) throwError(`Module ${modulename} not found`);
          logger.info(`+-+ trying to get context db ${db?.alias} upgrading ${db?.upgrading} with modules ${JSON.stringify(Object.keys(Modules ?? {}))}`)
          const context = await getContext(conn, Modules);
          const rpcRes: any[] | undefined = await (Modules[moduleName] as ModuleInterface)?.rpc?.[
            methodname
          ].call(dbId, dbUser, context, ...params);
          if (rpcRes) output = JSON.stringify(rpcRes);
          // once the rpc completes updating the `end_date`
          // will complete the polling
          const query = `
            update iasql_rpc
            set end_date = now(), output = '${output}'
            where opid = uuid('${opid}');
          `;
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
            update iasql_rpc
            set end_date = now(), err = '${error}'
            where opid = uuid('${opid}');
          `;
          await conn.query(query);
        } finally {
          try {
            const recordCount = await iasql.getDbRecCount(conn);
            const rpcCount = await iasql.getRpcCount(conn);
            await MetadataRepo.updateDbCounts(dbId, recordCount, undefined, rpcCount);
            // list is called by us and has no dbAlias so ignore
            // TODO: refactor properly this condition if (uid && modulename !== 'iasqlFunctions' && methodname !== 'modulesList')
            if (uid)
              telemetry.logRpc(
                modulename,
                methodname,
                {
                  dbId,
                  email,
                  dbAlias,
                  recordCount,
                  rpcCount,
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
  const { conn: prevConn } = workerRunners[dbId] ?? { conn: undefined };
  await prevConn?.dropConn();
  workerRunners[dbId] = { runner, conn };
}

async function getContext(conn: TypeormWrapper, Modules: any): Promise<Context> {
  // Find all of the installed modules, and create the context object only for these
  const iasqlModule =
    Modules?.IasqlPlatform?.utils?.IasqlModule ??
    Modules?.iasqlPlatform?.iasqlModule ??
    throwError('Core IasqlModule not found');
  const moduleNames = (await conn.find(iasqlModule)).map((m: any) => m.name);
  const memo: any = {};
  const context: Context = { orm: conn, memo };
  for (const name of moduleNames) {
    const mod = (Object.values(Modules) as ModuleInterface[]).find(
      m => `${m.name}@${m.version}` === name,
    ) as ModuleInterface;
    if (!mod) throwError(`This should be impossible. Cannot find module ${name}`);
    const moduleContext = mod?.provides?.context ?? {};
    Object.keys(moduleContext).forEach(k => {
      if (typeof moduleContext[k] === 'function') {
        context[k] = moduleContext[k];
      } else {
        context[k] = cloneDeep(moduleContext[k]);
      }
    });
  }
  return context;
}

export async function resetConn(dbId: string) {
  const { conn: currentConn } = workerRunners[dbId] ?? { conn: undefined };
  if (currentConn) {
    const newConn = await TypeormWrapper.createConn(dbId, { name: uuidv4() });
    // create a dblink server per db to reduce connections when calling dblink in iasql op SP
    // https://aws.amazon.com/blogs/database/migrating-oracle-autonomous-transactions-to-postgresql/
    await newConn.query(`CREATE EXTENSION IF NOT EXISTS dblink;`);
    await newConn.query(
      `CREATE SERVER IF NOT EXISTS loopback_dblink_${dbId} FOREIGN DATA WRAPPER dblink_fdw OPTIONS (host '${config.db.host}', dbname '${dbId}', port '${config.db.port}');`,
    );
    await newConn.query(
      `CREATE USER MAPPING IF NOT EXISTS FOR ${config.db.user} SERVER loopback_dblink_${dbId} OPTIONS (user '${config.db.user}', password '${config.db.password}')`,
    );
    workerRunners[dbId].conn = newConn;
    // await currentConn.query(`DROP SERVER IF EXISTS loopback_dblink_${dbId} CASCADE`);
    // await currentConn.dropConn();
  } else {
    logger.warn(`Graphile worker for ${dbId} not found`);
  }
}

export async function stop(dbId: string) {
  logger.info(`+-+ stop being called for db ${dbId}`)
  logger.info(`+-+ current worker runners ${Object.keys(workerRunners ?? {})}`)
  const { runner, conn } = workerRunners[dbId] ?? { runner: undefined, conn: undefined };
  if (runner && conn) {
    try {
      await runner.stop();
    } catch (e) {
      logger.warn(
        `Graphile workers for ${dbId} has already been stopped. Perhaps Kubernetes is going to restart the process?`,
        { e },
      );
    }
    try {
      await conn.query(`DROP SERVER IF EXISTS loopback_dblink_${dbId} CASCADE`);
      await conn.dropConn();
    } catch (err: any) {
      logger.info(`+-+ error letting go the connection ${err.message}`)
    }
    logger.info(`+-+ deleting worker ${dbId} from ${Object.keys(workerRunners)}`)
    delete workerRunners[dbId];
    logger.info(`+-+ remaining worker runners ${Object.keys(workerRunners)}`)
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

if (require.main === module) {
  const app = express();
  const port = 14527;

  function respondErrorAndDie(res: any, err: any) {
    res.status(500).send(err);
    logger.error(`Scheduler exited with error: ${err}`);
    process.exit(13);
  }

  app.use((req: any, res: any, next: any) => {
    logger.info(`Scheduler called on ${req.url}`);
    next();
  });

  app.get('/init/', (req: any, res: any) => {
    init()
      .then(() => res.sendStatus(200))
      .catch(e => respondErrorAndDie(res, e.message));
  });

  app.get('/start/:dbId/:dbUser/', (req: any, res: any) => {
    const { dbId, dbUser } = req.params;
    start(dbId, dbUser)
      .then(() => res.sendStatus(200))
      .catch(e => respondErrorAndDie(res, e.message));
  });

  app.get('/stop/:dbId/', (req: any, res: any) => {
    const { dbId } = req.params;
    stop(dbId)
      .then(() => res.sendStatus(200))
      .catch(e => respondErrorAndDie(res, e.message));
  });

  app.get('/resetConn/:dbId/', (req: any, res: any) => {
    const { dbId } = req.params;
    resetConn(dbId)
      .then(() => res.sendStatus(200))
      .catch(e => respondErrorAndDie(res, e.message));
  });

  app.get('/stopAll/', (req: any, res: any) => {
    stopAll()
      .then(() => res.sendStatus(200))
      .catch(e => respondErrorAndDie(res, e.message));
  });

  app.head('/health/', (req: any, res: any) => {
    res.sendStatus(200);
  });

  app.listen(port, () => {
    logger.info(`Scheduler running on port ${port}`);
  });
}
