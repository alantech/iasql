import { Region as RegionAWS } from '@aws-sdk/client-ec2'

import indexedAWS from '../services/indexed-aws'

export class RegionMapper {

  // TODO avoid using name property?
  // @ts-ignore: Built-in name override
  static name(regionAWS: RegionAWS) {
    const regionName = regionAWS?.RegionName;
    if (regionName) {
      indexedAWS.set('region', regionName, regionAWS);
    }
    return regionName;
  }

  static endpoint(regionAWS: RegionAWS) {
    const endpoint = regionAWS?.Endpoint;
    return endpoint;
  }

  static optInStatus(regionAWS: RegionAWS) {
    const optInStatus = regionAWS?.OptInStatus;
    return optInStatus;
  }
}
