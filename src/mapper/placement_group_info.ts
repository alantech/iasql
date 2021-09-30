import { PlacementGroupInfo as PlacementGroupInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { PlacementGroupInfo, } from '../entity/placement_group_info';
import { PlacementGroupStrategyMapper } from './placement_group_strategy';
import { AWS } from '../services/gateways/aws';

export const PlacementGroupInfoMapper = new EntityMapper(PlacementGroupInfo, {
  supportedStrategies: (placementGroupInfo: PlacementGroupInfoAWS, indexes: IndexedAWS) =>
    placementGroupInfo?.SupportedStrategies?.length ?
      placementGroupInfo.SupportedStrategies.map(
        supportedStrategy => PlacementGroupStrategyMapper.fromAWS(supportedStrategy, indexes)
      ) :
      [],
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
