import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, ManyToMany, JoinTable, } from 'typeorm';
import { AvailabilityZone, EngineVersion, SupportedEngineMode } from '.';
import { awsPrimaryKey } from '../services/aws-primary-key';
import { source, Source } from '../services/source-of-truth';
import { ActivityStreamMode } from './activity_stream_mode';
import { DBInstanceClass } from './db_instance_class';
import { ProcessorFeature } from './processor_feature';

@source(Source.AWS)
@Entity()
export class OrderableDBInstanceOption {
  @PrimaryGeneratedColumn()
  id: number;

  // Engine + EngineVersion + DBInstanceClass + StorageType
  @awsPrimaryKey
  @Column()
  compositeKey: string;

  @ManyToOne(() => EngineVersion)
  @JoinColumn({
    name: 'engine_version_id',
  })
  engine: EngineVersion;

  @ManyToOne(() => DBInstanceClass, { cascade: true, })
  @JoinColumn({
    name: 'db_instance_class_id',
  })
  dbInstanceClass: DBInstanceClass;

  @Column({
    nullable: true,
  })
  licenseModel: string;

  @ManyToMany(() => AvailabilityZone)
  @JoinTable()
  availabilityZones: AvailabilityZone[];

  @Column({
    nullable: true,
  })
  multiAZCapable: boolean;

  @Column({
    nullable: true,
  })
  readReplicaCapable: boolean;

  @Column({
    nullable: true,
  })
  vpc: boolean;

  @Column({
    nullable: true,
  })
  supportsStorageEncryption: boolean;

  @Column({
    nullable: true,
  })
  storageType: string;

  @Column({
    nullable: true,
  })
  supportsIops: boolean;

  @Column({
    nullable: true,
  })
  supportsEnhancedMonitoring: boolean;

  @Column({
    nullable: true,
  })
  supportsIAMDatabaseAuthentication: boolean;

  @Column({
    nullable: true,
  })
  supportsPerformanceInsights: boolean;

  @Column({
    nullable: true,
    type: 'decimal',
  })
  minStorageSize: number;

  @Column({
    nullable: true,
    type: 'decimal',
  })
  maxStorageSize: number;

  @Column({
    nullable: true,
    type: 'decimal',
  })
  minIopsPerDbInstance: number;

  @Column({
    nullable: true,
    type: 'decimal',
  })
  maxIopsPerDbInstance: number;

  @Column({
    nullable: true,
    type: 'decimal',
  })
  minIopsPerGib: number;

  @Column({
    nullable: true,
    type: 'decimal',
  })
  maxIopsPerGib: number;

  @ManyToMany(() => ProcessorFeature, { cascade: true, })
  @JoinTable()
  availableProcessorFeatures: ProcessorFeature[];

  @ManyToMany(() => SupportedEngineMode, { cascade: true, })
  @JoinTable()
  supportedEngineModes: SupportedEngineMode[];

  @Column({
    nullable: true,
  })
  supportsStorageAutoscaling: boolean;

  @Column({
    nullable: true,
  })
  supportsKerberosAuthentication: boolean;

  @Column({
    nullable: true,
  })
  outpostCapable: boolean;

  @ManyToMany(() => ActivityStreamMode, { cascade: true, })
  @JoinTable()
  supportedActivityStreamModes: ActivityStreamMode[];

  @Column({
    nullable: true,
  })
  supportsGlobalDatabases: boolean;
}
