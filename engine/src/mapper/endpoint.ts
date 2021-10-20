import { Endpoint as EndpointAWS } from '@aws-sdk/client-rds'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity'
import { Endpoint, } from '../entity/endpoint'
import { AWS } from '../services/gateways/aws'

export const EndpointMapper = new EntityMapper(Endpoint, {
  address: (e: EndpointAWS) => e?.Address ?? null,
  port: (e: EndpointAWS) => e?.Port ?? null,
  hostedZoneId: (e: EndpointAWS) => e?.HostedZoneId ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
