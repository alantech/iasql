import * as express from 'express';
import { Response } from 'express';
import { Request } from 'express-jwt';
import { default as cloneDeep } from 'lodash.clonedeep';
import { v4 as uuidv4 } from 'uuid';

import config from '../config';
import { throwError } from '../config/config';
import { IasqlDatabase } from '../entity';
import * as Modules from '../modules';
import { Context, ModuleBase, ModuleInterface } from '../modules';
import * as dbMan from '../services/db-manager';
import * as iasql from '../services/iasql';
import logger, { logErrSentry } from '../services/logger';
import MetadataRepo from '../services/repositories/metadata';
import * as telemetry from '../services/telemetry';
import { TypeormWrapper } from '../services/typeorm';

export const db = express.Router();

async function connectHandler(req: Request, res: Response) {
  logger.info('Calling /connect');
  const dbAlias = req.params?.dbAlias ?? req.body?.dbAlias;
  if (!dbAlias)
    return res
      .status(400)
      .json(
        `Required key(s) not provided: ${['dbAlias'].filter(k => !req.params.hasOwnProperty(k)).join(', ')}`,
      );
  const uid = dbMan.getUid(req.auth);
  const email = dbMan.getEmail(req.auth);
  const dbId = dbMan.genDbId(dbAlias);
  try {
    const database = await iasql.connect(dbAlias, uid, email, dbId);
    res.json(database);
    telemetry.logConnect(
      uid,
      {
        dbAlias,
        dbId,
        email,
        recordCount: database.recordCount,
        rpcCount: database.operationCount,
        dbVersion: config.version,
      },
      {},
    );
  } catch (e) {
    const error = logErrSentry(e, uid, email, dbAlias);
    res.status(500).end(error);
    telemetry.logConnect(uid, { dbId, email }, { error });
  }
}

db.get('/connect/:dbAlias', connectHandler);

db.post('/connect', connectHandler);

// TODO revive and test
/*db.post('/import', async (req: Request, res: Response) => {
  logger.info('Calling /import');
  const {dump, dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey} = req.body;
  if (!dump || !dbAlias || !awsRegion || !awsAccessKeyId || !awsSecretAccessKey) return res.status(400).json(
    `Required key(s) not provided: ${[
      'dump', 'dbAlias', 'awsRegion', 'awsAccessKeyId', 'awsSecretAccessKey'
    ].filter(k => !req.body.hasOwnProperty(k)).join(', ')}`
  );
  try {
    res.json(
      await iasql.load(dump, dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey, req.auth)
    );
  } catch (e) {
    res.status(500).end(logger.error(e));
  }
});*/

db.post('/export', async (req: Request, res: Response) => {
  logger.info('Calling /export');
  const { dbAlias, dataOnly } = req.body;
  if (!dbAlias) return res.status(400).json("Required key 'dbAlias' not provided");
  const uid = dbMan.getUid(req.auth);
  const email = dbMan.getEmail(req.auth);
  try {
    const database: IasqlDatabase = await MetadataRepo.getDb(uid, dbAlias);
    const dbId = database.pgName;
    res.send(await iasql.dump(dbId, !!dataOnly));
    telemetry.logExport(
      uid,
      {
        dbAlias,
        email,
        dbId,
        recordCount: database.recordCount,
        rpcCount: database.operationCount,
      },
      { dataOnly: !!dataOnly },
    );
  } catch (e) {
    res.status(500).end(logErrSentry(e, uid, email, dbAlias));
  }
});

db.get('/list', async (req: Request, res: Response) => {
  logger.info('Calling /list');
  const uid = dbMan.getUid(req.auth);
  const email = dbMan.getEmail(req.auth);
  try {
    const dbs = await MetadataRepo.getDbs(uid, email);
    res.json(dbs);
  } catch (e) {
    res.status(500).end(logErrSentry(e, uid, email));
  }
});

db.get('/disconnect/:dbAlias', async (req: Request, res: Response) => {
  logger.info('Calling /disconnect');
  const { dbAlias } = req.params;
  if (!dbAlias) return res.status(400).json("Required key 'dbAlias' not provided");
  const uid = dbMan.getUid(req.auth);
  const email = dbMan.getEmail(req.auth);
  let dbId;
  try {
    dbId = await iasql.disconnect(dbAlias, uid);
    telemetry.logDisconnect(
      uid,
      {
        dbAlias,
        email,
        dbId,
      },
      {},
    );
    res.json(`disconnected ${dbAlias}`);
  } catch (e) {
    const error = logErrSentry(e, uid, email, dbAlias);
    res.status(500).end(error);
    telemetry.logDisconnect(uid, { dbId, email }, { error });
  }
});

function until(p: Promise<any>, timeout: number) {
  return new Promise((resolve, reject) => {
    let finished: boolean = false;
    p.then((val: any) => {
      if (!finished) {
        finished = true;
        resolve(val);
      }
    }).catch((err: any) => {
      if (!finished) {
        finished = true;
        reject(err);
      }
    });
    setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error(`Timeout of ${timeout}ms reached`));
      }
    }, timeout);
  });
}

db.post('/run/:dbAlias', async (req: Request, res: Response) => {
  logger.info('Calling /run');
  if (!config.db.sqlViaRest) return res.status(400).end('SQL Querying via REST disabled');
  const { dbAlias } = req.params;
  if (!dbAlias) return res.status(400).json("Required key 'dbAlias' not provided");
  const { sql, byStatement, byUser } = req.body;
  const uid = dbMan.getUid(req.auth);
  const email = dbMan.getEmail(req.auth);
  let dbId;
  try {
    const database: IasqlDatabase = await MetadataRepo.getDb(uid, dbAlias);
    dbId = database.pgName;
    const output = await until(iasql.runSql(dbAlias, uid, sql, byStatement ?? false), 5 * 60 * 1000);
    // ignore queries done by the dashboard itself
    if (byUser) {
      telemetry.logRunSql(
        uid,
        {
          dbAlias,
          email,
          dbId,
        },
        {
          output: JSON.stringify(output),
          sql,
        },
      );
    }
    res.json(output);
  } catch (e: any) {
    // do not send to sentry
    const error = e?.message ?? '';
    if (/^Timeout of/.test(error)) {
      // Avoid 500 here to keep ELB/Fargate happy
      res
        .status(400)
        .end(
          'This query is taking a long time. It will continue running in the background. You may query (with simpler queries) to see.',
        );
    } else {
      logger.error(`RunSQL user error: ${error}`, { uid, dbId, email, dbAlias });
      res.status(500).end(error);
    }
    telemetry.logRunSql(uid, { dbId, email }, { sql, error });
  }
});

export async function getContext(conn: TypeormWrapper, AllModules: any): Promise<Context> {
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

db.post('/rpc', async (req: Request, res: Response) => {
  logger.info('Calling /rpc');
  const { dbId, dbUser, params, modulename, methodname } = req.body;
  const missing = [];
  if (!dbId) missing.push('dbId');
  if (!dbUser) missing.push('dbUser');
  if (!params) missing.push('params');
  if (!modulename) missing.push('modulename');
  if (!methodname) missing.push('methodname');
  if (!!missing.length) return res.status(400).json(`Required key(s) ${missing.join(', ')} not provided`);
  try {
    let output: string | undefined;
    let error;
    const user = await MetadataRepo.getUserFromDbId(dbId);
    const uid = user?.id;
    const email = user?.email;
    const dbAlias = user?.iasqlDatabases?.[0]?.alias;
    const dbRec = await MetadataRepo.getDbById(dbId);
    const versionString = await TypeormWrapper.getVersionString(dbId);
    const conn = await TypeormWrapper.createConn(dbId, { name: uuidv4() });
    // Do not call RPCs if db is upgrading.
    if (dbRec?.upgrading) {
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
      output = JSON.stringify(rpcRes);
      return res.status(200).json(rpcRes);
    } catch (e) {
      let errorMessage: string | string[] = logErrSentry(e, uid, email, dbAlias);
      // split message if multiple lines in it
      if (errorMessage.includes('\n')) errorMessage = errorMessage.split('\n');
      // error must be valid JSON as a string
      error = JSON.stringify({ message: errorMessage });
      return res.status(400).json({ message: errorMessage });
    } finally {
      try {
        const recordCount = await iasql.getDbRecCount(conn);
        const rpcCount = 0;
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
  } catch (e: any) {
    logger.error(`RPC user error: ${e?.message}`, { dbUser, dbId, params, modulename, methodname });
    res.status(500).end(e?.message);
  }
});

db.post('/event', async (req: Request, res: Response) => {
  logger.info('Calling /event');
  const { dbAlias, eventName, buttonAlias, sql } = req.body;
  const uid = dbMan.getUid(req.auth);
  const email = dbMan.getEmail(req.auth);
  if (dbAlias) {
    const database: IasqlDatabase = await MetadataRepo.getDb(uid, dbAlias);
    const dbId = database.pgName;
    telemetry.logEvent(uid, eventName, { dbAlias, dbId, email }, { buttonAlias, sql });
  } else {
    telemetry.logEvent(uid, eventName, { email }, { buttonAlias, sql });
  }
  res.json(`event registered`);
});
