import { Region as RegionAWS, } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'
import { Region, } from '../entity/region';

export const RegionMapper = new EntityMapper(Region, {
  name: (region: RegionAWS, _indexes: IndexedAWS) => region?.RegionName,
  endpoint: (region: RegionAWS, _indexes: IndexedAWS) => region?.Endpoint,
  optInStatus: (region: RegionAWS, _indexes: IndexedAWS) => region?.OptInStatus,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const regions = (await awsClient.getRegions())?.Regions ?? [];
    indexes.setAll(Region, regions, 'RegionName');
  },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
