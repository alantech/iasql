import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';
import { Container } from '.';
import { awsPrimaryKey } from '../services/aws-primary-key';
import { noDiff } from '../services/diff';

import { source, Source } from '../services/source-of-truth';
import { Compatibility } from './compatibility';

export enum NetworkMode {
  AWSVPC = "awsvpc",
  BRIDGE = "bridge",
  HOST = "host",
  NONE = "none"
}

export enum TaskDefinitionStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE"
}

export enum CpuMemCombination {
  "256_512" = "256-512",
  "256_1024" = "256-1024",
  "256_2048" = "256-2048",
  "512_1024" = "512-1024",
  "512_2048" = "512-2048",
  "512_3072" = "512-3072",
  "512_4096" = "512-4096",
  "1024_2048" = "1024-2048",
  "1024_3072" = "1024-3072",
  "1024_4096" = "1024-4096",
  "1024_5120" = "1024-5120",
  "1024_6144" = "1024-6144",
  "1024_7168" = "1024-7168",
  "1024_8192" = "1024-8192",
  "2048_4096" = "2048-4096",
  "2048_5120" = "2048-5120",
  "2048_6144" = "2048-6144",
  "2048_7168" = "2048-7168",
  "2048_8192" = "2048-8192",
  "2048_9216" = "2048-9216",
  "2048_10240" = "2048-10240",
  "2048_11264" = "2048-11264",
  "2048_12288" = "2048-12288",
  "2048_13312" = "2048-13312",
  "2048_14336" = "2048-14336",
  "2048_15360" = "2048-15360",
  "2048_16384" = "2048-16384",
  "4096_8192" = "4096-8192",
  "4096_9216" = "4096-9216",
  "4096_10240" = "4096-10240",
  "4096_11264" = "4096-11264",
  "4096_12288" = "4096-12288",
  "4096_13312" = "4096-13312",
  "4096_14336" = "4096-14336",
  "4096_15360" = "4096-15360",
  "4096_16384" = "4096-16384",
  "4096_17408" = "4096-17408",
  "4096_18432" = "4096-18432",
  "4096_19456" = "4096-19456",
  "4096_20480" = "4096-20480",
  "4096_21504" = "4096-21504",
  "4096_22528" = "4096-22528",
  "4096_23552" = "4096-23552",
  "4096_24576" = "4096-24576",
  "4096_25600" = "4096-25600",
  "4096_26624" = "4096-26624",
  "4096_27648" = "4096-27648",
  "4096_28672" = "4096-28672",
  "4096_29696" = "4096-29696",
  "4096_30720" = "4096-30720"
}

@source(Source.DB)
@Entity()
export class TaskDefinition {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;
  @noDiff

  @Column({
    nullable: true,
  })
  taskDefinitionArn?: string;

  @noDiff
  @ManyToMany(() => Container, { cascade: true, eager: true, })
  @JoinTable()
  containers?: Container[];

  @noDiff
  @Column()
  family: string;

  @noDiff
  @Column({
    nullable: true,
    type: 'int',
  })
  revision?: number;

  // Generated column to index properly
  @awsPrimaryKey
  @Column()
  familyRevision: string;

  @noDiff
  @Column({
    nullable: true,
  })
  taskRoleArn?: string;

  @noDiff
  @Column({
    nullable: true,
  })
  executionRoleArn?: string;

  @noDiff
  @Column({
    nullable: true,
    type: 'enum',
    enum: NetworkMode,
  })
  networkMode?: NetworkMode;

  @noDiff
  @Column({
    nullable: true,
    type: 'enum',
    enum: TaskDefinitionStatus,
  })
  status?: TaskDefinitionStatus;

  @noDiff
  @ManyToMany(() => Compatibility, { cascade: true, eager: true, })
  @JoinTable()
  reqCompatibilities?: Compatibility[];

  @noDiff
  @Column({
    nullable: true,
    type: 'enum',
    enum: CpuMemCombination,
  })
  cpuMemory: CpuMemCombination;
}
