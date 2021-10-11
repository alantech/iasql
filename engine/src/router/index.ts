import * as express from 'express'
import config from '../config';
import { AWS } from '../services/gateways/aws';

import { db, } from './db'

const v1 = express.Router();

v1.use('/db', db)

v1.get('/aws', async (req, res) => {
  const awsClient = new AWS({
    region: config.region ?? 'eu-west-1',
    credentials: {
      accessKeyId: config.accessKeyId ?? '',
      secretAccessKey: config.secretAccessKey ?? '',
    },
  });
  // const ord = await awsClient.getOrdInsOpt();
  const ord = await awsClient.getEngineVersions();
  res.end(JSON.stringify(ord))
})

export { v1 };