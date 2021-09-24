import { Region as RegionAWS } from '@aws-sdk/client-ec2'

export class RegionMapper {

  // TODO avoid using name property?
  // @ts-ignore: Built-in name override
  static name(regionAWS: RegionAWS, indexes?: any) {
    const regionName = regionAWS?.RegionName;
    if (regionName && indexes?.regions) {
      indexes.regions[regionName] = regionAWS;
    }
    return regionName;
  }

  static endpoint(regionAWS: RegionAWS, indexes?: any) {
    const endpoint = regionAWS?.Endpoint;
    return endpoint;
  }

  static optInStatus(regionAWS: RegionAWS, indexes?: any) {
    const optInStatus = regionAWS?.OptInStatus;
    return optInStatus;
  }
}
