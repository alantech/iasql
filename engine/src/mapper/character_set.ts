import { CharacterSet as CharacterSetAWS, } from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { CharacterSet, } from '../entity/character_set'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const CharacterSetMapper = new EntityMapper(CharacterSet, {
  characterSetName: (cs: CharacterSetAWS) => cs.CharacterSetName,
  characterSetDescription: (cs: CharacterSetAWS) => cs.CharacterSetDescription ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    return
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
