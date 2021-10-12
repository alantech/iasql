import { _InstanceType as InstanceTypeValueAWS } from '@aws-sdk/client-ec2';

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { InstanceTypeValue, } from '../entity/instance_type_value'

export const InstanceTypeValueMapper = new EntityMapper(InstanceTypeValue, {
  name: (instanceType: InstanceTypeValueAWS) => instanceType ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
