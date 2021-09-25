import { inspect } from 'util'

import * as express from 'express'

import { AWS } from './services/gateways/aws'
import config from './config'
import { aws, } from './router/aws'
import { db, } from './router/db'
import { RegionMapper } from './mapper/region'

const v1 = express.Router();
v1.get('/map', async(_req, res) => {
  const awsClient = new AWS({
    region: config.region ?? 'eu-west-1',
    credentials: {
      accessKeyId: config.accessKeyId ?? '',
      secretAccessKey: config.secretAccessKey ?? '',
    },
  })
  const regionsAWS = await awsClient.getRegions();
  const entity = await RegionMapper.fromAWS(regionsAWS.Regions?.pop());
  res.end(`mapped: ${inspect(entity)}`);
})

v1.use('/db', db)
v1.use('/aws', aws)

export { v1 };