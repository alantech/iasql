import { NetworkCardInfo as NetworkCardInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { NetworkCardInfo } from '../entity/network_card_info';
import { AWS } from '../services/gateways/aws';

export const NetworkCardInfoMapper = new EntityMapper(NetworkCardInfo, {
  networkCardIndex: (networkCardInfo: NetworkCardInfoAWS, _indexes: IndexedAWS) => networkCardInfo?.NetworkCardIndex ?? null,
  networkPerformance: (networkCardInfo: NetworkCardInfoAWS, _indexes: IndexedAWS) => networkCardInfo?.NetworkPerformance ?? null,
  maximumNetworkInterfaces: (networkCardInfo: NetworkCardInfoAWS, _indexes: IndexedAWS) => networkCardInfo?.MaximumNetworkInterfaces ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
