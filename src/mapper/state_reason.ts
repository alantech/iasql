import { StateReason as StateReasonAWS} from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'
import { StateReason, } from '../entity/state_reason';

export const StateReasonMapper = new EntityMapper(StateReason, {
  code: (sr: StateReasonAWS, _indexes: IndexedAWS) => sr?.Code,
  message: (sr: StateReasonAWS, _indexes: IndexedAWS) => sr?.Message,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    // Set by AMI
    return
  },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
