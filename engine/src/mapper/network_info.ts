import { NetworkInfo as NetworkInfoAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EFAInfoMapper, } from './efa_info'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { NetworkCardInfoMapper, } from './network_card_info'
import { NetworkInfo, } from '../entity/network_info'

export const NetworkInfoMapper = new EntityMapper(NetworkInfo, {
  networkPerformance: (networkInfo: NetworkInfoAWS) => networkInfo?.NetworkPerformance ?? null,
  maximumNetworkInterfaces: (networkInfo: NetworkInfoAWS) => networkInfo?.MaximumNetworkInterfaces ?? null,
  maximumNetworkCards: (networkInfo: NetworkInfoAWS) => networkInfo?.MaximumNetworkCards ?? null,
  defaultNetworkCardIndex: (networkInfo: NetworkInfoAWS) => networkInfo?.DefaultNetworkCardIndex ?? null,
  networkCards: async (networkInfo: NetworkInfoAWS, awsClient: AWS, indexes: IndexedAWS) =>
    networkInfo?.NetworkCards?.length ?
      await Promise.all(networkInfo?.NetworkCards?.map(
        networkCardInfo => NetworkCardInfoMapper.fromAWS(networkCardInfo, awsClient, indexes)
      )) :
      [],
  ipv4AddressesPerInterface: (networkInfo: NetworkInfoAWS) => networkInfo?.Ipv4AddressesPerInterface ?? null,
  ipv6AddressesPerInterface: (networkInfo: NetworkInfoAWS) => networkInfo?.Ipv6AddressesPerInterface ?? null,
  ipv6Supported: (networkInfo: NetworkInfoAWS) => networkInfo?.Ipv6Supported ?? null,
  enaSupport: (networkInfo: NetworkInfoAWS) => networkInfo?.EnaSupport ?? null,
  efaSupported: (networkInfo: NetworkInfoAWS) => networkInfo?.EfaSupported ?? null,
  efaInfo: (networkInfo: NetworkInfoAWS, awsClient: AWS, indexes: IndexedAWS) =>
    networkInfo?.EfaInfo ? EFAInfoMapper.fromAWS(
      networkInfo?.EfaInfo, awsClient, indexes
    ) : null,
  encryptionInTransitSupported: (networkInfo: NetworkInfoAWS) => networkInfo?.EncryptionInTransitSupported ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
