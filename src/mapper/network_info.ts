import { NetworkInfo as NetworkInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { NetworkInfo } from '../entity/network_info';
import { EFAInfoMapper } from './efa_info';
import { NetworkCardInfoMapper } from './network_card_info';
import { AWS } from '../services/gateways/aws';

export const NetworkInfoMapper = new EntityMapper(NetworkInfo, {
  networkPerformance: (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.NetworkPerformance ?? null,
  maximumNetworkInterfaces: (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.MaximumNetworkInterfaces ?? null,
  maximumNetworkCards: (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.MaximumNetworkCards ?? null,
  defaultNetworkCardIndex: (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.DefaultNetworkCardIndex ?? null,
  networkCards: (networkInfo: NetworkInfoAWS, indexes: IndexedAWS) =>
    networkInfo?.NetworkCards?.length ?
      networkInfo?.NetworkCards?.map(
        networkCardInfo => NetworkCardInfoMapper.fromAWS(networkCardInfo, indexes)
      ) :
      [],
  ipv4AddressesPerInterface: (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.Ipv4AddressesPerInterface ?? null,
  ipv6AddressesPerInterface: (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.Ipv6AddressesPerInterface ?? null,
  ipv6Supported: (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.Ipv6Supported ?? null,
  enaSupport: (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.EnaSupport ?? null,
  efaSupported: (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.EfaSupported ?? null,
  efaInfo: (networkInfo: NetworkInfoAWS, indexes: IndexedAWS) =>
    networkInfo?.EfaInfo ? EFAInfoMapper.fromAWS(
      networkInfo?.EfaInfo, indexes
    ) : null,
  encryptionInTransitSupported: (networkInfo: NetworkInfoAWS, _indexes: IndexedAWS) => networkInfo?.EncryptionInTransitSupported ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
