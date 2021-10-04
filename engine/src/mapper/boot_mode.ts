import { BootModeValues } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { BootMode, } from '../entity/boot_mode';
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'

export const BootModeMapper = new EntityMapper(BootMode, {
  mode: (bootMode: BootModeValues, _indexes: IndexedAWS) => bootMode ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    // Handled by AMI
    return
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
