import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, JoinTable, ManyToMany, ManyToOne, } from 'typeorm';
import { UpgradeTarget } from '.';
import { awsPrimaryKey } from '../services/aws-primary-key';
import { noDiff } from '../services/diff';
import { CharacterSet } from './character_set';
import { ExportableLogType } from './exportable_log_type';
import { FeatureName } from './feature_name';
import { SupportedEngineMode } from './supported_engine_mode';
import { Timezone } from './timezone';

@Entity()
export class EngineVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  engine: string;

  @awsPrimaryKey
  @Column({
    unique: true,
  })
  engineVersion: string;

  @Column()
  dbParameterGroupFamily: string;

  @Column()
  dbEngineDescription: string;

  @Column()
  dbEngineVersionDescription: string;

  @Column()
  supportsLogExportsToCloudwatchLogs: boolean;

  @Column()
  supportsReadReplica: boolean;

  @Column()
  status: string;

  @Column()
  supportsParallelQuery: boolean;

  @Column()
  supportsGlobalDatabases: boolean;

  @ManyToMany(() => UpgradeTarget, { cascade: true, eager: true, })
  @JoinTable()
  validUpgradeTargets: UpgradeTarget[];

  @noDiff
  @ManyToMany(() => ExportableLogType, { cascade: true, eager: true, })
  @JoinTable()
  exportableLogTypes: ExportableLogType[];

  @noDiff
  @ManyToMany(() => SupportedEngineMode, { cascade: true, eager: true, })
  @JoinTable()
  supportedEngineModes: SupportedEngineMode[];

  @noDiff
  @ManyToOne(() => CharacterSet, { cascade: true, eager: true, })
  @JoinColumn({
    name: 'character_set_id'
  })
  defaultCharacterSet: CharacterSet;

  @noDiff
  @ManyToMany(() => CharacterSet, { cascade: true, eager: true, })
  @JoinTable()
  supportedCharacterSets: CharacterSet[];

  @noDiff
  @ManyToMany(() => CharacterSet, { cascade: true, eager: true, })
  @JoinTable()
  supportedNcharCharacterSets: CharacterSet[];

  @noDiff
  @ManyToMany(() => FeatureName, { cascade: true, eager: true, })
  @JoinTable()
  supportedFeatureNames: FeatureName[];

  @noDiff
  @ManyToMany(() => Timezone, { cascade: true, eager: true, })
  @JoinTable()
  supportedTimezones: Timezone[];
}
