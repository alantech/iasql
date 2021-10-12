import { DBParameterGroupStatus as DBParameterGroupStatusAWS } from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { DBParameterGroupStatus, } from '../entity/db_parameter_group_status'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const DBParameterGroupStatusMapper = new EntityMapper(DBParameterGroupStatus, {
  dbParameterGroupName: (dbParameterGroupStatus: DBParameterGroupStatusAWS) => dbParameterGroupStatus?.DBParameterGroupName ?? null,
  parameterApplyStatus: (dbParameterGroupStatus: DBParameterGroupStatusAWS) => dbParameterGroupStatus?.ParameterApplyStatus ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
