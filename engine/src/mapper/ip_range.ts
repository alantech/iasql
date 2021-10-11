import { IPRange as IPRangeAWS } from '@aws-sdk/client-rds'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { IPRange, } from '../entity/ip_range';
import { AWS } from '../services/gateways/aws';

export const IPRangeMapper = new EntityMapper(IPRange, {
  status: (ip: IPRangeAWS, _indexes: IndexedAWS) => ip?.Status ?? null,
  cidrip: (ip: IPRangeAWS, _indexes: IndexedAWS) => ip?.CIDRIP ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
