import * as express from 'express'
import config from '../config';
import { AWS } from '../services/gateways/aws';

import { db, } from './db'

const v1 = express.Router();

v1.use('/db', db)

v1.get('/aws/db', async (req, res) => {
  try {
    const awsClient = new AWS({
      region: config.region ?? 'eu-west-1',
      credentials: {
        accessKeyId: config.accessKeyId ?? '',
        secretAccessKey: config.secretAccessKey ?? '',
      },
    });
    console.log('aws client created')
    const input = await awsClient.createDBInstance();
    console.log()
    res.end(`input: ${JSON.stringify(input)}`);
  } catch (e) {
    res.end(`${e}`);
  }
})

export { v1 };