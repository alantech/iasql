import { DBEngineVersion as DBEngineVersionAWS } from '@aws-sdk/client-rds'

import { AWS, } from '../services/gateways/aws'
import { EngineVersion, } from '../entity/engine_version';
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'
import { ExportableLogTypeMapper } from './exportable_log_type';
import { SupportedEngineModeMapper } from './supported_engine_mode';
import { CharacterSetMapper } from './character_set';
import { FeatureNameMapper } from './feature_name';
import { TimezoneMapper } from './timezone';
import { UpgradeTargetMapper } from '.';

export const EngineVersionMapper: EntityMapper = new EntityMapper(EngineVersion, {
  engine: (ev: DBEngineVersionAWS, _indexes: IndexedAWS) => ev.Engine,
  engineVersion: (ev: DBEngineVersionAWS, _indexes: IndexedAWS) => ev.EngineVersion,
  dbParameterGroupFamily: (ev: DBEngineVersionAWS, _indexes: IndexedAWS) => ev.DBParameterGroupFamily,
  dbEngineDescription: (ev: DBEngineVersionAWS, _indexes: IndexedAWS) => ev.DBEngineDescription,
  dbEngineVersionDescription: (ev: DBEngineVersionAWS, _indexes: IndexedAWS) => ev.DBEngineVersionDescription,
  supportsLogExportsToCloudwatchLogs: (ev: DBEngineVersionAWS, _indexes: IndexedAWS) => ev.SupportsLogExportsToCloudwatchLogs,
  supportsReadReplica: (ev: DBEngineVersionAWS, _indexes: IndexedAWS) => ev.SupportsReadReplica,
  status: (ev: DBEngineVersionAWS, _indexes: IndexedAWS) => ev.Status,
  supportsParallelQuery: (ev: DBEngineVersionAWS, _indexes: IndexedAWS) => ev.SupportsParallelQuery,
  supportsGlobalDatabases: (ev: DBEngineVersionAWS, _indexes: IndexedAWS) => ev.SupportsGlobalDatabases,
  validUpgradeTargets: (ev: DBEngineVersionAWS, indexes: IndexedAWS) =>
    ev.ValidUpgradeTarget?.length ?
      ev.ValidUpgradeTarget.map(vt => UpgradeTargetMapper.fromAWS(vt, indexes))
      : [],
  exportableLogTypes: (ev: DBEngineVersionAWS, indexes: IndexedAWS) =>
    ev.ExportableLogTypes?.length ?
      ev.ExportableLogTypes.map(type => ExportableLogTypeMapper.fromAWS(type, indexes))
      : [],
  supportedEngineModes: (ev: DBEngineVersionAWS, indexes: IndexedAWS) =>
    ev.SupportedEngineModes?.length ?
      ev.SupportedEngineModes.map(mode => SupportedEngineModeMapper.fromAWS(mode, indexes))
      : [],
  defaultCharacterSet: (ev: DBEngineVersionAWS, indexes: IndexedAWS) =>
    ev.DefaultCharacterSet ?
      CharacterSetMapper.fromAWS(ev.DefaultCharacterSet, indexes)
      : null,
  supportedCharacterSets: (ev: DBEngineVersionAWS, indexes: IndexedAWS) =>
    ev.SupportedCharacterSets?.length ?
      ev.SupportedCharacterSets.map(chs => CharacterSetMapper.fromAWS(chs, indexes))
      : [],
  supportedNcharCharacterSets: (ev: DBEngineVersionAWS, indexes: IndexedAWS) =>
    ev.SupportedNcharCharacterSets?.length ?
      ev.SupportedNcharCharacterSets.map(chs => CharacterSetMapper.fromAWS(chs, indexes))
      : [],
  supportedFeatureNames: (ev: DBEngineVersionAWS, indexes: IndexedAWS) =>
    ev.SupportedFeatureNames?.length ?
      ev.SupportedFeatureNames.map(name => FeatureNameMapper.fromAWS(name, indexes))
      : [],
  supportedTimezones: (ev: DBEngineVersionAWS, indexes: IndexedAWS) =>
    ev.SupportedTimezones?.length ?
      ev.SupportedTimezones.map(tz => TimezoneMapper.fromAWS(tz, indexes))
      : [],
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const engines = (await awsClient.getEngineVersions())?.DBEngineVersions ?? [];
    indexes.setAll(EngineVersion, engines, 'EngineVersion');
    const t2 = Date.now();
    console.log(`EngineVersion set in ${t2 - t1}ms`);
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
