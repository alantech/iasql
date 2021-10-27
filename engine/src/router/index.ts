import * as express from 'express'
import { AWS } from '../services/gateways/aws';

import { db, } from './db'

const v1 = express.Router();

v1.use('/db', db)

db.post('/aws', async (req, res) => {
  const t1 = Date.now();
  const {dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey} = req.body;
  const awsClient = new AWS({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    },
  });
  const subnets = await awsClient.getSubnets();
  res.end(`ok = ${JSON.stringify(subnets)}`)
})

export { v1 };