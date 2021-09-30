import { AWS, } from '../services/gateways/aws'
import { PlacementGroupStrategy, } from '../entity/placement_group_strategy';
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'

export const PlacementGroupStrategyMapper = new EntityMapper(PlacementGroupStrategy, {
  strategy: (strategy: string, _indexes: IndexedAWS) => strategy,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
