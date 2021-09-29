import { NetworkCardInfo as NetworkCardInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { NetworkCardInfo } from '../entity/network_card_info';

export const NetworkCardInfoMapper = new EntityMapper(NetworkCardInfo, {
  networkCardIndex: async (networkCardInfo: NetworkCardInfoAWS, _indexes: IndexedAWS) => networkCardInfo?.NetworkCardIndex,
  networkPerformance: async (networkCardInfo: NetworkCardInfoAWS, _indexes: IndexedAWS) => networkCardInfo?.NetworkPerformance,
  maximumNetworkInterfaces: async (networkCardInfo: NetworkCardInfoAWS, _indexes: IndexedAWS) => networkCardInfo?.MaximumNetworkInterfaces,
})
