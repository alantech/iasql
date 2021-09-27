import { StateReason as StateReasonAWS} from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { StateReason, } from '../entity/state_reason';

export const StateReasonMapper = new EntityMapper(StateReason, {
  code: async (sr: StateReasonAWS, _indexes: IndexedAWS) => sr.Code,
  message: async (sr: StateReasonAWS, _indexes: IndexedAWS) => sr.Message,
})
