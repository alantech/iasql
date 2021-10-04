import { AvailabilityZone as AvailabilityZoneAWS, Region as RegionAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { AvailabilityZone, } from '../entity/availability_zone';
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'
import { AvailabilityZoneMessageMapper } from './availability_zone_message';
import { RegionMapper } from '.';
import { Region } from '../entity';

export const AvailabilityZoneMapper: EntityMapper = new EntityMapper(AvailabilityZone, {
  state: (availabilityZone: AvailabilityZoneAWS, _indexes: IndexedAWS) => availabilityZone?.State,
  optInStatus: (availabilityZone: AvailabilityZoneAWS, _indexes: IndexedAWS) => availabilityZone?.OptInStatus,
  messages: (availabilityZone: AvailabilityZoneAWS, indexes: IndexedAWS) =>
    availabilityZone?.Messages?.length ?
      availabilityZone.Messages.map(m => AvailabilityZoneMessageMapper.fromAWS({ message: m, availabilityZone }, indexes))
      : [],
  region: (availabilityZone: AvailabilityZoneAWS, indexes: IndexedAWS) => RegionMapper.fromAWS(indexes.get(Region, availabilityZone?.RegionName), indexes),
  zoneName: (availabilityZone: AvailabilityZoneAWS, _indexes: IndexedAWS) => availabilityZone?.ZoneName,
  zoneId: (availabilityZone: AvailabilityZoneAWS, _indexes: IndexedAWS) => availabilityZone?.ZoneId,
  groupName: (availabilityZone: AvailabilityZoneAWS, _indexes: IndexedAWS) => availabilityZone?.GroupName,
  networkBorderGroup: (availabilityZone: AvailabilityZoneAWS, _indexes: IndexedAWS) => availabilityZone?.NetworkBorderGroup,
  parentZone: (availabilityZone: AvailabilityZoneAWS, indexes: IndexedAWS) => {
    if (availabilityZone?.ParentZoneId) {
      const parentZone = indexes.get(AvailabilityZone, availabilityZone.ParentZoneId);
      if (parentZone) {
        return AvailabilityZoneMapper.fromAWS(parentZone, indexes)
      }
    }
    return null;
  },
  // TODO: handle intance type - availability zone realtion
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const regions = indexes.get(Region);
    const optInRegions = Object.entries(regions ?? {})
      .filter(([_, v]) => (v as RegionAWS).OptInStatus !== 'not-opted-in')
      .map(([k,_]) => k);
    const availabilityZones = (await awsClient.getAvailabilityZones(optInRegions))?.AvailabilityZones ?? [];
    indexes.setAll(AvailabilityZone, availabilityZones, 'ZoneId');
    const t2 = Date.now();
    console.log(`AvailabilityZone set in ${t2 - t1}ms`);
  },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
