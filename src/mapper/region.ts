import { Region as RegionAWS } from '@aws-sdk/client-ec2'
import { Region } from '../entity/region'

export class RegionMapper {
  static fromAWS(regionAWS: RegionAWS) {
    const region = new Region();
    region.name = regionAWS.RegionName ?? ''
    region.endpoint = regionAWS.Endpoint ?? ''
    region.optInStatus = regionAWS.OptInStatus ?? ''
    return region
  }
}
