import { EfaInfo as EfaInfoAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EFAInfo, } from '../entity/efa_info'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const EFAInfoMapper = new EntityMapper(EFAInfo, {
  maximumEFAInterfaces: (efaInfo: EfaInfoAWS) => efaInfo?.MaximumEfaInterfaces ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
