import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, JoinTable, ManyToMany, ManyToOne, } from 'typeorm';
import { UpgradeTarget } from '.';
import { awsPrimaryKey } from '../services/aws-primary-key';
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

  @ManyToMany(() => ExportableLogType, { cascade: true, eager: true, })
  @JoinTable()
  exportableLogTypes: ExportableLogType[];

  @ManyToMany(() => SupportedEngineMode, { cascade: true, eager: true, })
  @JoinTable()
  supportedEngineModes: SupportedEngineMode[];

  @ManyToOne(() => CharacterSet, { cascade: true, eager: true, })
  @JoinColumn({
    name: 'character_set_id'
  })
  defaultCharacterSet: CharacterSet;

  @ManyToMany(() => CharacterSet, { cascade: true, eager: true, })
  @JoinTable()
  supportedCharacterSets: CharacterSet[];

  @ManyToMany(() => CharacterSet, { cascade: true, eager: true, })
  @JoinTable()
  supportedNcharCharacterSets: CharacterSet[];

  @ManyToMany(() => FeatureName, { cascade: true, eager: true, })
  @JoinTable()
  supportedFeatureNames: FeatureName[];

  @ManyToMany(() => Timezone, { cascade: true, eager: true, })
  @JoinTable()
  supportedTimezones: Timezone[];
}
