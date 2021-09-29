import { StateReason as StateReasonAWS} from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { StateReason, } from '../entity/state_reason';

export const StateReasonMapper = new EntityMapper(StateReason, {
  code: (sr: StateReasonAWS, _indexes: IndexedAWS) => sr?.Code,
  message: (sr: StateReasonAWS, _indexes: IndexedAWS) => sr?.Message,
}, {
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
