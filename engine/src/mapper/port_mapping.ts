import { PortMapping as PortMappingAWS, } from '@aws-sdk/client-ecs'

import { AWS, } from '../services/gateways/aws'
import { PortMapping, } from '../entity/port_mapping'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const PortMappingMapper = new EntityMapper(PortMapping, {
  containerPort: (p: PortMappingAWS) => p?.containerPort ?? null,
  hostPort: (p: PortMappingAWS) => p?.hostPort ?? null,
  protocol: (p: PortMappingAWS) => p.protocol,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
