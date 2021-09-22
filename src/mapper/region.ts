import { Region as RegionAWS } from '@aws-sdk/client-ec2'

import { Typeorm } from '../services/typeorm'
import { Region } from '../entity/region'

export class RegionMapper {
  
  static async fromAWS(regionAWS: RegionAWS[]) {
    const regions = regionAWS.map(r => {
      const region = new Region();
      region.name = r.RegionName ?? null
      region.endpoint = r.Endpoint ?? null
      region.optInStatus = r.OptInStatus ?? null
    });
    // TODO make database name dynamic
    const db = 'typeorm'
    const orm = await Typeorm.createConn(db);
    await orm.save(Region, regions);
  }
}
