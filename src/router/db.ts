import * as express from 'express';
import { Request, Response } from 'express';
import { default as cloneDeep } from 'lodash.clonedeep';
import { v4 as uuidv4 } from 'uuid';

import config from '../config';
import { throwError } from '../config/config';
import { IasqlDatabase } from '../entity';
import * as Modules from '../modules';
import { Context, ModuleBase, ModuleInterface, PostTransactionCheck, PreTransactionCheck } from '../modules';
import * as iasqlFunctions from '../modules/iasql_functions/iasql';
import * as dbMan from '../services/db-manager';
import * as iasql from '../services/iasql';
import logger, { logErrSentry, mergeErrorMessages } from '../services/logger';
import MetadataRepo from '../services/repositories/metadata';
import * as telemetry from '../services/telemetry';
import { TypeormWrapper } from '../services/typeorm';

export const db = express.Router();

async function connectHandler(req: Request, res: Response) {
  logger.debug('Calling /connect');
  const { dbAlias, user: uid } = req.body;
  if (!dbAlias)
    return res
      .status(400)
      .json(
        `Required key(s) not provided: ${['dbAlias'].filter(k => !req.params.hasOwnProperty(k)).join(', ')}`,
      );
  const email = await MetadataRepo.getEmailByUid(uid);
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

db.post('/disconnect', async (req: Request, res: Response) => {
  logger.debug('Calling /disconnect');
  const { dbAlias, user: uid } = req.body;
  if (!dbAlias) return res.status(400).json("Required key 'dbAlias' not provided");
  const email = await MetadataRepo.getEmailByUid(uid);
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
  logger.debug(`Calling /rpc ${req.body?.methodname ?? ''}`);
  const { dbId, dbUser, params, modulename, methodname, preTransaction, postTransaction } = req.body;
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
      const rpcRes = await rpcCall(
        dbId,
        dbUser,
        moduleInstanceName,
        methodname,
        params,
        context,
        conn,
        preTransaction,
        postTransaction,
      );
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
        await MetadataRepo.updateRecordCount(dbId, recordCount);
        // If the user is not the default user, log the RPC call
        if (uid && dbUser !== config.db.user) {
          telemetry.logRpc(
            uid,
            modulename,
            methodname,
            {
              dbId,
              email: email ?? '',
              dbAlias,
              recordCount,
              dbVersion: versionString,
            },
            {
              params,
              output,
              error,
            },
          );
        }
      } catch (e: any) {
        logger.error('could not log op event', e);
      } finally {
        await conn.dropConn();
      }
    }
  } catch (e: any) {
    logger.error(`RPC user error: ${e?.message}`, { dbUser, dbId, params, modulename, methodname });
    res.status(500).end(e?.message);
  }
});

async function rpcCall(
  dbId: string,
  dbUser: string,
  moduleInstanceName: string,
  methodname: string,
  params: string[],
  context: Context,
  conn: TypeormWrapper,
  preTransaction?: PreTransactionCheck,
  postTransaction?: PostTransactionCheck,
): Promise<any[] | undefined> {
  let rpcRes: any[] | undefined;
  let rpcErr: any;
  let commitErr: any;
  switch (preTransaction) {
    case PreTransactionCheck.NO_CHECK:
      break;
    case PreTransactionCheck.FAIL_IF_NOT_LOCKED:
      const openTransaction = await iasqlFunctions.isOpenTransaction(conn);
      if (!openTransaction) {
        throw new Error('Cannot execute without calling iasql_begin() first');
      }
      break;
    case PreTransactionCheck.WAIT_FOR_LOCK:
      await iasqlFunctions.maybeOpenTransaction(conn);
      break;
    default:
      await conn.query(`select * from iasql_begin();`);
      break;
  }
  try {
    rpcRes = await ((Modules as any)[moduleInstanceName] as ModuleInterface)?.rpc?.[methodname].call(
      dbId,
      dbUser,
      context,
      ...params,
    );
  } catch (e) {
    rpcErr = e;
  }
  switch (postTransaction) {
    case PostTransactionCheck.NO_CHECK:
      break;
    case PostTransactionCheck.UNLOCK_IF_SUCCEED:
      if (!rpcErr) {
        await iasqlFunctions.closeTransaction(conn);
      }
      break;
    case PostTransactionCheck.UNLOCK_ALWAYS:
      await iasqlFunctions.closeTransaction(conn);
      break;
    default:
      try {
        await conn.query(`select * from iasql_commit();`);
      } catch (e) {
        await iasqlFunctions.closeTransaction(conn);
        commitErr = e;
      }
      break;
  }
  if (rpcErr && commitErr) {
    const errMessage = mergeErrorMessages([rpcErr, commitErr]);
    rpcErr.message = errMessage;
    throw rpcErr;
  }
  if (rpcErr) throw rpcErr;
  if (commitErr) throw commitErr;
  return rpcRes;
}
