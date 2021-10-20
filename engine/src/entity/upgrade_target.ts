import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, ManyToMany, JoinTable, } from 'typeorm';
import { EngineVersion, SupportedEngineMode } from '.';

@Entity()
export class UpgradeTarget {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => EngineVersion)
  @JoinColumn({
    name: 'engine_version_id',
  })
  engine: EngineVersion;

  @Column({
    nullable: true,
  })
  description?: string;

  @Column({
    nullable: true,
  })
  autoUpgrade?: boolean;

  @Column({
    nullable: true,
  })
  isMajorVersionUpgrade?: boolean;

  @ManyToMany(() => SupportedEngineMode)
  @JoinTable()
  supportedEngineModes?: SupportedEngineMode[];

  @Column({
    nullable: true,
  })
  supportsParallelQuery?: boolean;

  @Column({
    nullable: true,
  })
  supportsGlobalDatabases?: boolean;
}
