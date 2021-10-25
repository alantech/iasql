import { Vpc as VpcAWS} from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { Vpc, } from '../entity/vpc'

export const VpcMapper = new EntityMapper(Vpc, {
  cidrBlock: (vpc: VpcAWS) => vpc.CidrBlock,
  state: (vpc: VpcAWS) => vpc?.State ?? null,
  vpcId: (vpc: VpcAWS) => vpc?.VpcId ?? null,
  isDefault: (vpc: VpcAWS) => vpc?.IsDefault ?? null,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const vpcs = (await awsClient.getVpcs())?.Vpcs ?? [];
    indexes.setAll(Vpc, vpcs, 'VpcId');
    const t2 = Date.now();
    console.log(`Vpcs set in ${t2 - t1}ms`);
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
