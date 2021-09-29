import { NetworkInfo as NetworkInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { NetworkInfo } from '../entity/network_info';
import { EFAInfoMapper } from './efa_info';
import { NetworkCardInfoMapper } from './network_card_info';

export const NetworkInfoMapper = new EntityMapper(NetworkInfo, {
  networkPerformance: async (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.NetworkPerformance,
  maximumNetworkInterfaces: async (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.MaximumNetworkInterfaces,
  maximumNetworkCards: async (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.MaximumNetworkCards,
  defaultNetworkCardIndex: async (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.DefaultNetworkCardIndex,
  networkCards: async (networkInfo: NetworkInfoAWS, indexes: IndexedAWS) =>
    networkInfo?.NetworkCards && networkInfo?.NetworkCards.length ?
      await Promise.all(networkInfo?.NetworkCards?.map(
        networkCardInfo => NetworkCardInfoMapper.fromAWS(networkCardInfo, indexes)
      )) :
      [],
  ipv4AddressesPerInterface: async (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.Ipv4AddressesPerInterface,
  ipv6AddressesPerInterface: async (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.Ipv6AddressesPerInterface,
  ipv6Supported: async (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.Ipv6Supported,
  enaSupport: async (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.EnaSupport,
  efaSupported: async (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.EfaSupported,
  efaInfo: async (networkInfo: NetworkInfoAWS, indexes: IndexedAWS) =>
    networkInfo?.EfaInfo ? EFAInfoMapper.fromAWS(
      networkInfo?.EfaInfo, indexes
    ) : undefined,
  encryptionInTransitSupported: async (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.EncryptionInTransitSupported,
})
