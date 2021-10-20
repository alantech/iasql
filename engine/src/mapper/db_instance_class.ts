import { AWS, } from '../services/gateways/aws'
import { DBInstanceClass, } from '../entity/db_instance_class'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const DBInstanceClassMapper = new EntityMapper(DBInstanceClass, {
  name: (name: string) => name,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    return
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
