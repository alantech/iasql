import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity'
import { CloudwatchLogsExport, } from '../entity/cloudwatch_logs_export'
import { AWS, } from '../services/gateways/aws'

export const CloudwatchLogsExportMapper = new EntityMapper(CloudwatchLogsExport, {
  name: (name: string) => name,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
