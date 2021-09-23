import { Region as RegionAWS } from '@aws-sdk/client-ec2'

import { Region } from '../entity/region'

export class RegionMapper {
  
  static async fromAWS(regionAWS: RegionAWS[]): Promise<any> {
    const regions = regionAWS.map(r => {
      const region = new Region();
      region.name = r?.RegionName
      region.endpoint = r?.Endpoint
      region.optInStatus = r?.OptInStatus
      return region;
    });
    return regions;
  }
}
