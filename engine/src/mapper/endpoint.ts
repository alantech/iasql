import { Endpoint as EndpointAWS } from '@aws-sdk/client-rds'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { Endpoint, } from '../entity/endpoint';
import { AWS } from '../services/gateways/aws';

export const EndpointMapper = new EntityMapper(Endpoint, {
  address: (e: EndpointAWS, _indexes: IndexedAWS) => e?.Address ?? null,
  port: (e: EndpointAWS, _indexes: IndexedAWS) => e?.Port ?? null,
  hostedZoneId: (e: EndpointAWS, _indexes: IndexedAWS) => e?.HostedZoneId ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
