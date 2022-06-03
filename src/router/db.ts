import * as express from 'express'
import { IasqlDatabase } from '../entity';

import * as dbMan from '../services/db-manager';
import * as iasql from '../services/iasql'
import MetadataRepo from '../services/repositories/metadata'
import * as telemetry from '../services/telemetry'
import logger, { logUserErr } from '../services/logger'
import config from '../config'

export const db = express.Router();

db.get('/connect/:dbAlias', async (req, res) => {
  logger.info('Calling /connect');
  const {dbAlias} = req.params;
  if (!dbAlias) return res.status(400).json(
    `Required key(s) not provided: ${[
      'dbAlias'
    ].filter(k => !req.params.hasOwnProperty(k)).join(', ')}`
  );
  const uid = dbMan.getUid(req.user);
  const email = dbMan.getEmail(req.user);
  try {
    const database = await iasql.connect(
      dbAlias, uid, email
    );
    res.json(database);
    telemetry.logDbConnect(database.id, dbAlias, uid, email);
  } catch (e) {
    res.status(500).end(logUserErr(e, uid, email, dbAlias));
  }
});

db.post('/connect', async (req, res) => {
  logger.info('Calling /connect');
  const {dbAlias} = req.body;
  if (!dbAlias) return res.status(400).json(
    `Required key(s) not provided: ${[
      'dbAlias'
    ].filter(k => !req.body.hasOwnProperty(k)).join(', ')}`
  );
  const uid = dbMan.getUid(req.user);
  const email = dbMan.getEmail(req.user);
  try {
    const database = await iasql.connect(
      dbAlias, uid, email
    );
    res.json(database);
    telemetry.logDbConnect(database.id, dbAlias, uid, email);
  } catch (e) {
    res.status(500).end(logUserErr(e, uid, email, dbAlias));
  }
});

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
    res.send(await iasql.dump(database.pgName, !!dataOnly));
    telemetry.logDbExport(database.pgName, !!dataOnly);
  } catch (e) {
    res.status(500).end(logUserErr(e, uid, email, dbAlias));
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
    res.status(500).end(logUserErr(e, uid, email));
  }
});

db.get('/disconnect/:dbAlias', async (req, res) => {
  logger.info('Calling /disconnect');
  const { dbAlias } = req.params;
  if (!dbAlias) return res.status(400).json("Required key 'dbAlias' not provided");
  const uid = dbMan.getUid(req.user);
  const email = dbMan.getEmail(req.user);
  try {
    const dbId = await iasql.disconnect(dbAlias, uid);
    telemetry.logDbDisconnect(dbId);
    res.json(`disconnected ${dbAlias}`);
  } catch (e) {
    res.status(500).end(logUserErr(e, uid, email, dbAlias));
  }
});

db.post('/run/:dbAlias', async (req, res) => {
  logger.info('Calling /run');
  if (!config.db.sqlViaRest) return res.status(400).end('SQL Querying via REST disabled');
  const { dbAlias, } = req.params;
  const sql = req.body;
  const uid = dbMan.getUid(req.user);
  const email = dbMan.getEmail(req.user);
  try {
    const out = await iasql.runSql(dbAlias, uid, sql);
    res.json(out);
  } catch (e) {
    res.status(500).end(logUserErr(e, uid, email, dbAlias));
  }
});