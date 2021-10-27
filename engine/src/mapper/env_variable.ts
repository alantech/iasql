import { KeyValuePair, } from '@aws-sdk/client-ecs'

import { AWS, } from '../services/gateways/aws'
import { EnvVariable, } from '../entity/env_variable'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const EnvVariableMapper = new EntityMapper(EnvVariable, {
  name: (kp: KeyValuePair) => kp.name,
  value: (kp: KeyValuePair) => kp.value,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
