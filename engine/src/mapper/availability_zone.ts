import { AvailabilityZone as AvailabilityZoneAWS, Region as RegionAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { AvailabilityZone, } from '../entity/availability_zone'
import { AvailabilityZoneMessageMapper, RegionMapper } from '.'
import { DepError, } from '../services/lazy-dep'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { Region, } from '../entity'

export const AvailabilityZoneMapper: EntityMapper = new EntityMapper(AvailabilityZone, {
  state: (availabilityZone: AvailabilityZoneAWS) => availabilityZone?.State,
  optInStatus: (availabilityZone: AvailabilityZoneAWS) => availabilityZone?.OptInStatus,
  messages: async (availabilityZone: AvailabilityZoneAWS, awsClient: AWS, indexes: IndexedAWS) =>
    availabilityZone?.Messages?.length ?
      await Promise.all(availabilityZone.Messages.map(m => AvailabilityZoneMessageMapper.fromAWS({ message: m, availabilityZone }, awsClient, indexes)))
      : [],
  region: async (
    availabilityZone: AvailabilityZoneAWS,
    awsClient: AWS,
    indexes: IndexedAWS,
  ) => await RegionMapper.fromAWS(indexes.get(Region, availabilityZone?.RegionName), awsClient, indexes),
  zoneName: (availabilityZone: AvailabilityZoneAWS) => availabilityZone?.ZoneName,
  zoneId: (availabilityZone: AvailabilityZoneAWS) => availabilityZone?.ZoneId,
  groupName: (availabilityZone: AvailabilityZoneAWS) => availabilityZone?.GroupName,
  networkBorderGroup: (availabilityZone: AvailabilityZoneAWS) => availabilityZone?.NetworkBorderGroup,
  parentZone: async (availabilityZone: AvailabilityZoneAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (availabilityZone?.ParentZoneId) {
      const parentZone = indexes.get(AvailabilityZone, availabilityZone.ParentZoneId);
      if (parentZone) {
        return await AvailabilityZoneMapper.fromAWS(parentZone, awsClient, indexes);
      }
    }
    return null;
  },
  // TODO: handle intance type - availability zone relation
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const regions = indexes.get(Region);
    if (!regions) throw new DepError('Regions must be loaded first');
    const optInRegions = Object.entries(regions ?? {})
      .filter(([_, v]) => (v as RegionAWS).OptInStatus !== 'not-opted-in')
      .map(([k,_]) => k);
    const availabilityZones = (await awsClient.getAvailabilityZones(optInRegions))?.AvailabilityZones ?? [];
    indexes.setAll(AvailabilityZone, availabilityZones, 'ZoneId');
    const t2 = Date.now();
    console.log(`AvailabilityZone set in ${t2 - t1}ms`);
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
