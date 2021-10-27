import { DBEngineVersion as DBEngineVersionAWS } from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { EngineVersion, } from '../entity/engine_version'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { ExportableLogTypeMapper } from './exportable_log_type'
import { SupportedEngineModeMapper } from './supported_engine_mode'
import { CharacterSetMapper } from './character_set'
import { FeatureNameMapper } from './feature_name'
import { TimezoneMapper } from './timezone'
import { UpgradeTargetMapper } from '.'

export const EngineVersionMapper: EntityMapper = new EntityMapper(EngineVersion, {
  engine: (ev: DBEngineVersionAWS) => ev.Engine,
  engineVersion: (ev: DBEngineVersionAWS) => ev.EngineVersion,
  engineVersionKey: (ev: any) => ev.EngineVersionKey,
  dbParameterGroupFamily: (ev: DBEngineVersionAWS) => ev.DBParameterGroupFamily,
  dbEngineDescription: (ev: DBEngineVersionAWS) => ev.DBEngineDescription,
  dbEngineVersionDescription: (ev: DBEngineVersionAWS) => ev.DBEngineVersionDescription,
  supportsLogExportsToCloudwatchLogs: (ev: DBEngineVersionAWS) => ev.SupportsLogExportsToCloudwatchLogs,
  supportsReadReplica: (ev: DBEngineVersionAWS) => ev.SupportsReadReplica,
  status: (ev: DBEngineVersionAWS) => ev.Status,
  supportsParallelQuery: (ev: DBEngineVersionAWS) => ev.SupportsParallelQuery,
  supportsGlobalDatabases: (ev: DBEngineVersionAWS) => ev.SupportsGlobalDatabases,
  validUpgradeTargets: async (ev: DBEngineVersionAWS, awsClient: AWS, indexes: IndexedAWS) =>
    ev.ValidUpgradeTarget?.length ?
      await Promise.all(ev.ValidUpgradeTarget.map(vt => UpgradeTargetMapper.fromAWS(vt, awsClient, indexes)))
      : [],
  exportableLogTypes: async (ev: DBEngineVersionAWS, awsClient: AWS, indexes: IndexedAWS) =>
    ev.ExportableLogTypes?.length ?
      await Promise.all(ev.ExportableLogTypes.map(type => ExportableLogTypeMapper.fromAWS(type, awsClient, indexes)))
      : [],
  supportedEngineModes: async (ev: DBEngineVersionAWS, awsClient: AWS, indexes: IndexedAWS) =>
    ev.SupportedEngineModes?.length ?
      await Promise.all(ev.SupportedEngineModes.map(mode => SupportedEngineModeMapper.fromAWS(mode, awsClient, indexes)))
      : [],
  defaultCharacterSet: async (ev: DBEngineVersionAWS, awsClient: AWS, indexes: IndexedAWS) =>
    ev.DefaultCharacterSet ?
      await CharacterSetMapper.fromAWS(ev.DefaultCharacterSet, awsClient, indexes)
      : null,
  supportedCharacterSets: async (ev: DBEngineVersionAWS, awsClient: AWS, indexes: IndexedAWS) =>
    ev.SupportedCharacterSets?.length ?
      await Promise.all(ev.SupportedCharacterSets.map(chs => CharacterSetMapper.fromAWS(chs, awsClient, indexes)))
      : [],
  supportedNcharCharacterSets: async (ev: DBEngineVersionAWS, awsClient: AWS, indexes: IndexedAWS) =>
    ev.SupportedNcharCharacterSets?.length ?
      await Promise.all(ev.SupportedNcharCharacterSets.map(chs => CharacterSetMapper.fromAWS(chs, awsClient, indexes)))
      : [],
  supportedFeatureNames: async (ev: DBEngineVersionAWS, awsClient: AWS, indexes: IndexedAWS) =>
    ev.SupportedFeatureNames?.length ?
      await Promise.all(ev.SupportedFeatureNames.map(name => FeatureNameMapper.fromAWS(name, awsClient, indexes)))
      : [],
  supportedTimezones: async (ev: DBEngineVersionAWS, awsClient: AWS, indexes: IndexedAWS) =>
    ev.SupportedTimezones?.length ?
      await Promise.all(ev.SupportedTimezones.map(tz => TimezoneMapper.fromAWS(tz, awsClient, indexes)))
      : [],
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const engines = (await awsClient.getEngineVersions())?.DBEngineVersions ?? [];
    indexes.setAll(EngineVersion, engines.filter(e => e.Engine === 'postgres'), 'EngineVersionKey');  // TODO: remove engine filter
    const t2 = Date.now();
    console.log(`EngineVersion set in ${t2 - t1}ms`);
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
