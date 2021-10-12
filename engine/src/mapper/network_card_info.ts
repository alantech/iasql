import { NetworkCardInfo as NetworkCardInfoAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { NetworkCardInfo } from '../entity/network_card_info'

export const NetworkCardInfoMapper = new EntityMapper(NetworkCardInfo, {
  networkCardIndex: (networkCardInfo: NetworkCardInfoAWS) => networkCardInfo?.NetworkCardIndex ?? null,
  networkPerformance: (networkCardInfo: NetworkCardInfoAWS) => networkCardInfo?.NetworkPerformance ?? null,
  maximumNetworkInterfaces: (networkCardInfo: NetworkCardInfoAWS) => networkCardInfo?.MaximumNetworkInterfaces ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
