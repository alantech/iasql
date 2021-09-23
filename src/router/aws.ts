import * as express from 'express'

import config from '../config'
import { Region } from '../entity/region';
import { RegionMapper } from '../mapper/region'
import { AWS } from '../services/gateways/aws'
import { Typeorm } from '../services/typeorm';

const aws = express.Router();

aws.get('/regions', async (req, res) => {
  try {
    const awsClient = new AWS({ region: config.region ?? 'eu-west-1', credentials: { accessKeyId: config.accessKeyId ?? '', secretAccessKey: config.secretAccessKey ?? '' } })
    const awsRegions = await awsClient.getRegions()
    const regions = await RegionMapper.fromAWS(awsRegions?.Regions ?? [])
    // TODO make database name dynamic
    const db = 'typeorm'
    const orm = await Typeorm.createConn(db);
    await orm.save(Region, regions);
    await orm.dropConn();
    res.end('ok');
  } catch (e: any) {
    console.log(e)
    res.end(`Faiure getting regions from AWS. Error: ${e}`)
  }
});

export { aws };
