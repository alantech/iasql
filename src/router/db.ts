import * as express from 'express'
import { IasqlDatabase } from '../metadata/entity';

import * as dbMan from '../services/db-manager';
import * as iasql from '../services/iasql'
import MetadataRepo from '../services/repositories/metadata'
import { logUserErr } from '../services/logger'

export const db = express.Router();

db.post('/connect', async (req, res) => {
  console.log('Calling /connect');
  const {dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey} = req.body;
  if (!dbAlias || !awsRegion || !awsAccessKeyId || !awsSecretAccessKey) return res.status(400).json(
    `Required key(s) not provided: ${[
      'awsRegion', 'awsAccessKeyId', 'awsSecretAccessKey'
    ].filter(k => !req.body.hasOwnProperty(k)).join(', ')}`
  );
  try {
    res.json(
      await iasql.connect(
        dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey, dbMan.getUid(req.user), dbMan.getEmail(req.user)
      )
    );
  } catch (e) {
    res.status(500).end(logUserErr(e));
  }
});

// TODO revive and test
/*db.post('/import', async (req, res) => {
  console.log('Calling /import');
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
  console.log('Calling /export');
  const { dbAlias, dataOnly } = req.body;
  if (!dbAlias) return res.status(400).json("Required key 'dbAlias' not provided");
  try {
    res.send(await iasql.dump(dbAlias, dbMan.getUid(req.user), !!dataOnly));
  } catch (e) {
    res.status(500).end(logUserErr(e));
  }
});

db.get('/list', async (req, res) => {
  try {
    res.json(await iasql.list(dbMan.getUid(req.user), dbMan.getEmail(req.user), req.query.verbose === 'true'));
  } catch (e) {
    res.status(500).end(logUserErr(e));
  }
});

db.get('/disconnect/:dbAlias', async (req, res) => {
  const { dbAlias } = req.params;
  if (!dbAlias) return res.status(400).json("Required key 'dbAlias' not provided");
  try {
    res.json(await iasql.disconnect(dbAlias, dbMan.getUid(req.user)));
  } catch (e) {
    res.status(500).end(logUserErr(e));
  }
});

db.post('/apply', async (req, res) => {
  const { dbAlias, dryRun } = req.body;
  if (!dbAlias) return res.status(400).json("Required key 'dbAlias' not provided");
  try {
    const database: IasqlDatabase = await MetadataRepo.getDb(dbMan.getUid(req.user), dbAlias);
    res.json(await iasql.apply(database.pgName, dryRun));
  } catch (e) {
    res.status(500).end(logUserErr(e));
  }
});

db.post('/sync', async (req, res) => {
  const { dbAlias, dryRun } = req.body;
  if (!dbAlias) return res.status(400).json("Required key 'dbAlias' not provided");
  try {
    const database: IasqlDatabase = await MetadataRepo.getDb(dbMan.getUid(req.user), dbAlias);
    res.json(await iasql.sync(database.pgName, dryRun));
  } catch (e) {
    res.status(500).end(logUserErr(e));
  }
});

db.get('/get/:dbAlias', async (req, res) => {
  const { dbAlias, } = req.params;
  if (!dbAlias) return res.status(400).json("Required param 'dbAlias' not provided");
  try {
    const dbs = await iasql.list(dbMan.getUid(req.user), dbMan.getEmail(req.user), false);
    res.json((dbs as string[]).find((alias: string) => alias === dbAlias));
  } catch (e) {
    res.status(500).end(logUserErr(e));
  }
});

db.get('/:dbAlias/awsCfnStack/:stackName', async (req, res) => {
  const { dbAlias, stackName, } = req.params;
  if (!stackName || !dbAlias) return res.status(400).json("Required param 'stackName' not provided");
  const database: IasqlDatabase = await MetadataRepo.getDb(dbMan.getUid(req.user), dbAlias);
  try {
    res.json(await iasql.getStackInfo(database.pgName, stackName));
  } catch (e: any) {
    res.status(500).json(logUserErr(e));
  }
});
