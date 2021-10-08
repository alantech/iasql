import { AWS, } from '../services/gateways/aws'
import { ActivityStreamMode, } from '../entity/activity_stream_mode';
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'

export const ActivityStreamModeMapper = new EntityMapper(ActivityStreamMode, {
  mode: (mode: string, _indexes: IndexedAWS) => mode,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    return
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
