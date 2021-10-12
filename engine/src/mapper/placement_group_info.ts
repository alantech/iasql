import { PlacementGroupInfo as PlacementGroupInfoAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { PlacementGroupInfo, } from '../entity/placement_group_info'
import { PlacementGroupStrategyMapper, } from './placement_group_strategy'

export const PlacementGroupInfoMapper = new EntityMapper(PlacementGroupInfo, {
  supportedStrategies: async (placementGroupInfo: PlacementGroupInfoAWS, awsClient: AWS, indexes: IndexedAWS) =>
    placementGroupInfo?.SupportedStrategies?.length ?
      await Promise.all(placementGroupInfo.SupportedStrategies.map(
        supportedStrategy => PlacementGroupStrategyMapper.fromAWS(supportedStrategy, awsClient, indexes)
      )) :
      [],
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
