import { _InstanceType as InstanceTypeValueAWS } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { InstanceTypeValue, } from '../entity/instance_type_value';
import { AWS } from '../services/gateways/aws';

export const InstanceTypeValueMapper = new EntityMapper(InstanceTypeValue, {
  name: (instanceType: InstanceTypeValueAWS, _indexes: IndexedAWS) => instanceType ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
