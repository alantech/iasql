import { UpgradeTarget as UpgradeTargetAWS, } from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { UpgradeTarget, } from '../entity/upgrade_target'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { EngineVersionMapper, SupportedEngineModeMapper, } from '.'
import { EngineVersion, } from '../entity'

export const UpgradeTargetMapper = new EntityMapper(UpgradeTarget, {
  engine: async (t: UpgradeTargetAWS, awsClient: AWS, indexes: IndexedAWS) => {
    const engineVersionEntity = await indexes.getOr(EngineVersion, t.EngineVersion!, awsClient.getEngineVersion.bind(awsClient));
    return await EngineVersionMapper.fromAWS(engineVersionEntity, awsClient, indexes)
  },
  description: (t: UpgradeTargetAWS) => t.Description ?? null,
  autoUpgrade: (t: UpgradeTargetAWS) => t.AutoUpgrade ?? null,
  isMajorVersionUpgrade: (t: UpgradeTargetAWS) => t.IsMajorVersionUpgrade ?? null,
  supportedEngineModes: async (t: UpgradeTargetAWS, awsClient: AWS, indexes: IndexedAWS) =>
    t.SupportedEngineModes ?
      await Promise.all(t.SupportedEngineModes.map(mode => SupportedEngineModeMapper.fromAWS(mode, awsClient, indexes)))
      : [],
  supportsParallelQuery: (t: UpgradeTargetAWS) => t.SupportsParallelQuery ?? null,
  supportsGlobalDatabases: (t: UpgradeTargetAWS) => t.SupportsGlobalDatabases ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    return
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
