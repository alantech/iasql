import * as express from 'express';

import config from '../config';
import { IasqlDatabase } from '../entity';
import * as dbMan from '../services/db-manager';
import * as iasql from '../services/iasql';
import logger, { logErrSentry } from '../services/logger';
import MetadataRepo from '../services/repositories/metadata';
import * as telemetry from '../services/telemetry';

export const db = express.Router();

async function connectHandler(req: any, res: any) {
  logger.info('Calling /connect');
  const dbAlias = req.params?.dbAlias ?? req.body?.dbAlias;
  if (!dbAlias)
    return res
      .status(400)
      .json(
        `Required key(s) not provided: ${['dbAlias'].filter(k => !req.params.hasOwnProperty(k)).join(', ')}`,
      );
  const uid = dbMan.getUid(req.user);
  const email = dbMan.getEmail(req.user);
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
        operationCount: database.operationCount,
        dbVersion: config.modules.latestVersion,
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
/*db.post('/import', async (req, res) => {
  logger.info('Calling /import');
  const {dump, dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey} = req.body;
  if (!dump || !dbAlias || !awsRegion || !awsAccessKeyId || !awsSecretAccessKey) return res.status(400).json(
    `Required key(s) not provided: ${[
      'dump', 'dbAlias', 'awsRegion', 'awsAccessKeyId', 'awsSecretAccessKey'
    ].filter(k => !req.body.hasOwnProperty(k)).join(', ')}`
  );
  try {
    res.json(
      await iasql.load(dump, dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey, req.user)
    );
  } catch (e) {
    res.status(500).end(logger.error(e));
  }
});*/

db.post('/export', async (req, res) => {
  logger.info('Calling /export');
  const { dbAlias, dataOnly } = req.body;
  if (!dbAlias) return res.status(400).json("Required key 'dbAlias' not provided");
  const uid = dbMan.getUid(req.user);
  const email = dbMan.getEmail(req.user);
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
        operationCount: database.operationCount,
      },
      { dataOnly: !!dataOnly },
    );
  } catch (e) {
    res.status(500).end(logErrSentry(e, uid, email, dbAlias));
  }
});

db.get('/list', async (req, res) => {
  logger.info('Calling /list');
  const uid = dbMan.getUid(req.user);
  const email = dbMan.getEmail(req.user);
  try {
    const dbs = await MetadataRepo.getDbs(uid, email);
    res.json(dbs);
  } catch (e) {
    res.status(500).end(logErrSentry(e, uid, email));
  }
});

db.get('/disconnect/:dbAlias', async (req, res) => {
  logger.info('Calling /disconnect');
  const { dbAlias } = req.params;
  if (!dbAlias) return res.status(400).json("Required key 'dbAlias' not provided");
  const uid = dbMan.getUid(req.user);
  const email = dbMan.getEmail(req.user);
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

db.post('/run/:dbAlias', async (req, res) => {
  logger.info('Calling /run');
  if (!config.db.sqlViaRest) return res.status(400).end('SQL Querying via REST disabled');
  const { dbAlias } = req.params;
  if (!dbAlias) return res.status(400).json("Required key 'dbAlias' not provided");
  const { sql, byStatement, byUser } = req.body;
  const uid = dbMan.getUid(req.user);
  const email = dbMan.getEmail(req.user);
  let dbId;
  try {
    const database: IasqlDatabase = await MetadataRepo.getDb(uid, dbAlias);
    dbId = database.pgName;
    const output = await until(iasql.runSql(dbAlias, uid, sql, byStatement ?? false), 30000);
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

db.post('/event', async (req, res) => {
  logger.info('Calling /event');
  const { dbAlias, eventName, buttonAlias, sql } = req.body;
  const uid = dbMan.getUid(req.user);
  const email = dbMan.getEmail(req.user);
  if (dbAlias) {
    const database: IasqlDatabase = await MetadataRepo.getDb(uid, dbAlias);
    const dbId = database.pgName;
    telemetry.logEvent(uid, eventName, { dbAlias, dbId, email }, { buttonAlias, sql });
  } else {
    telemetry.logEvent(uid, eventName, { email }, { buttonAlias, sql });
  }
  res.json(`event registered`);
});
