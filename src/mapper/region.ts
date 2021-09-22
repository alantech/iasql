import { Region as RegionAWS } from '@aws-sdk/client-ec2'

import { Typeorm } from '../services/typeorm'
import { Region } from '../entity/region'

export class RegionMapper {
  
  static async fromAWS(regionAWS: RegionAWS[]) {
    const regions = regionAWS.map(r => {
      const region = new Region();
      // TODO in case the aws property does not exist do not default to '' but use actual nulls once we figure out how to handle the models
      region.name = r.RegionName ?? ''
      region.endpoint = r.Endpoint ?? ''
      region.optInStatus = r.OptInStatus ?? ''
    });
    // TODO make database name dynamic
    const db = 'typeorm'
    const orm = await Typeorm.createConn(db);
    await orm.save(Region, regions);
  }
}
