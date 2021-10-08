import { UpgradeTarget as UpgradeTargetAWS } from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { UpgradeTarget, } from '../entity/upgrade_target';
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'
import { EngineVersionMapper, SupportedEngineModeMapper } from '.';
import { EngineVersion } from '../entity';

export const UpgradeTargetMapper = new EntityMapper(UpgradeTarget, {
  engine: (t: UpgradeTargetAWS, indexes: IndexedAWS) => EngineVersionMapper.fromAWS(indexes.get(EngineVersion, t.EngineVersion), indexes),
  description: (t: UpgradeTargetAWS, _indexes: IndexedAWS) => t.Description ?? null,
  autoUpgrade: (t: UpgradeTargetAWS, _indexes: IndexedAWS) => t.AutoUpgrade ?? null,
  isMajorVersionUpgrade: (t: UpgradeTargetAWS, _indexes: IndexedAWS) => t.IsMajorVersionUpgrade ?? null,
  supportedEngineModes: (t: UpgradeTargetAWS, indexes: IndexedAWS) =>
    t.SupportedEngineModes ?
      t.SupportedEngineModes.map(mode => SupportedEngineModeMapper.fromAWS(mode, indexes))
      : [],
  supportsParallelQuery: (t: UpgradeTargetAWS, _indexes: IndexedAWS) => t.SupportsParallelQuery ?? null,
  supportsGlobalDatabases: (t: UpgradeTargetAWS, _indexes: IndexedAWS) => t.SupportsGlobalDatabases ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    return
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
