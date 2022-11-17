import * as sentry from '@sentry/node';
import express from 'express';
import { run } from 'graphile-worker';
import { default as cloneDeep } from 'lodash.clonedeep';
import { v4 as uuidv4 } from 'uuid';

import config from '../config';
import { throwError } from '../config/config';
import { IasqlDatabase } from '../entity';
import { Context, ModuleBase, ModuleInterface } from '../modules';
import * as Modules from '../modules';
import * as iasql from './iasql';
import logger, { logErrSentry } from './logger';
import MetadataRepo from './repositories/metadata';
import * as telemetry from './telemetry';
import { TypeormWrapper } from './typeorm';

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
  await conn.query(`
    DROP SERVER IF EXISTS loopback_dblink_${dbId} CASCADE;
    CREATE SERVER loopback_dblink_${dbId} FOREIGN DATA WRAPPER dblink_fdw OPTIONS (host '${config.db.host}', dbname '${dbId}', port '${config.db.port}');
  `);
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
      rpc: async (payload: any) => {
        const { params, opid, modulename, methodname } = payload;
        let output: string | undefined;
        let error;
        const user = await MetadataRepo.getUserFromDbId(dbId);
        const uid = user?.id;
        const email = user?.email;
        const dbAlias = user?.iasqlDatabases?.[0]?.alias;
        const db = await MetadataRepo.getDbById(dbId);
        const versionString = await TypeormWrapper.getVersionString(dbId);
        // Do not call RPCs if db is upgrading.
        if (db?.upgrading) {
          throwError(`Database ${dbId} is upgrading.`);
        }
        try {
          // Look for the Module's instance name with the RPC to be called
          if (versionString !== config.version) throwError(`Unsupported version ${versionString}`);
          const [moduleInstanceName] = Object.entries(Modules ?? {})
            .filter(([_, m]: [string, any]) => m instanceof ModuleBase)
            .find(([_, m]: [string, any]) => m.name === modulename) ?? ['unknown', undefined];
          if (!(Modules as any)[moduleInstanceName]) throwError(`Module ${modulename} not found`);
          const context = await getContext(conn, Modules);
          const rpcRes: any[] | undefined = await (
            (Modules as any)[moduleInstanceName] as ModuleInterface
          )?.rpc?.[methodname].call(dbId, dbUser, context, ...params);
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
                uid,
                modulename,
                methodname,
                {
                  dbId,
                  email: email ?? '',
                  dbAlias,
                  recordCount,
                  rpcCount,
                  dbVersion: versionString,
                },
                {
                  params,
                  output,
                  error,
                },
              );
          } catch (e: any) {
            logger.error('could not log op event', e);
          }
        }
      },
    },
  });
  // If a runner and a connection already exists for this dbId we need to end them and save the new ones
  const { runner: prevRunner, conn: prevConn } = workerRunners[dbId] ?? {
    runner: undefined,
    conn: undefined,
  };
  workerRunners[dbId] = { runner, conn };
  if (prevRunner && prevConn) {
    await stopRunner(prevRunner, dbId);
    await prevConn.dropConn();
  }
}

async function getContext(conn: TypeormWrapper, AllModules: any): Promise<Context> {
  // Find all of the installed modules, and create the context object only for these
  const iasqlModule =
    AllModules?.IasqlPlatform?.utils?.IasqlModule ??
    AllModules?.iasqlPlatform?.iasqlModule ??
    throwError('Core IasqlModule not found');
  const moduleNames = (await conn.find(iasqlModule)).map((m: any) => m.name);
  const memo: any = {};
  const context: Context = { orm: conn, memo };
  for (const name of moduleNames) {
    const mod = (Object.values(AllModules) as ModuleInterface[]).find(
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

export async function stop(dbId: string) {
  const { runner, conn } = workerRunners[dbId] ?? { runner: undefined, conn: undefined };
  if (runner && conn) {
    await stopRunner(runner, dbId);
    await stopServerConn(conn, dbId);
    delete workerRunners[dbId];
  } else {
    logger.warn(`Graphile worker for ${dbId} not found`);
  }
}

async function stopRunner(runner: any, dbId: string) {
  try {
    await runner.stop();
  } catch (e) {
    logger.warn(
      `Graphile workers for ${dbId} has already been stopped. Perhaps Kubernetes is going to restart the process?`,
      { e },
    );
  }
}

async function stopServerConn(conn: any, dbId: string) {
  try {
    await conn?.query(`DROP SERVER IF EXISTS loopback_dblink_${dbId} CASCADE`);
    await conn?.dropConn();
  } catch (e) {
    logger.warn(
      `The connection for ${dbId} has already been stopped. Perhaps Kubernetes is going to restart the process?`,
      { e },
    );
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
        return versionString === config.version ? db : undefined;
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

  app.use((req: any, _res: any, next: any) => {
    logger.info(`Scheduler called on ${req.url}`);
    next();
  });

  app.get('/init/', (_req: any, res: any) => {
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

  app.get('/stopAll/', (_req: any, res: any) => {
    stopAll()
      .then(() => res.sendStatus(200))
      .catch(e => respondErrorAndDie(res, e.message));
  });

  app.head('/health/', (_req: any, res: any) => {
    res.sendStatus(200);
  });

  app.listen(port, () => {
    logger.info(`Scheduler running on port ${port}`);
  });
}
