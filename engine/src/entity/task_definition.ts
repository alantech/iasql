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
  "0.25vCPU-0.5GB" = "0.25vCPU-0.5GB",
  "0.25vCPU-1GB" = "0.25vCPU-1GB",
  "0.25vCPU-2GB" = "0.25vCPU-2GB",
  "0.5vCPU-1GB" = "0.5vCPU-1GB",
  "0.5vCPU-2GB" = "0.5vCPU-2GB",
  "0.5vCPU-3GB" = "0.5vCPU-3GB",
  "0.5vCPU-4GB" = "0.5vCPU-4GB",
  "1vCPU-2GB" = "1vCPU-2GB",
  "1vCPU-3GB" = "1vCPU-3GB",
  "1vCPU-4GB" = "1vCPU-4GB",
  "1vCPU-5GB" = "1vCPU-5GB",
  "1vCPU-6GB" = "1vCPU-6GB",
  "1vCPU-7GB" = "1vCPU-7GB",
  "1vCPU-8GB" = "1vCPU-8GB",
  "2vCPU-4GB" = "2vCPU-4GB",
  "2vCPU-5GB" = "2vCPU-5GB",
  "2vCPU-6GB" = "2vCPU-6GB",
  "2vCPU-7GB" = "2vCPU-7GB",
  "2vCPU-8GB" = "2vCPU-8GB",
  "2vCPU-9GB" = "2vCPU-9GB",
  "2vCPU-10GB" = "2vCPU-10GB",
  "2vCPU-11GB" = "2vCPU-11GB",
  "2vCPU-12GB" = "2vCPU-12GB",
  "2vCPU-13GB" = "2vCPU-13GB",
  "2vCPU-14GB" = "2vCPU-14GB",
  "2vCPU-15GB" = "2vCPU-15GB",
  "2vCPU-16GB" = "2vCPU-16GB",
  "4vCPU-8GB" = "4vCPU-8GB",
  "4vCPU-9GB" = "4vCPU-9GB",
  "4vCPU-10GB" = "4vCPU-10GB",
  "4vCPU-11GB" = "4vCPU-11GB",
  "4vCPU-12GB" = "4vCPU-12GB",
  "4vCPU-13GB" = "4vCPU-13GB",
  "4vCPU-14GB" = "4vCPU-14GB",
  "4vCPU-15GB" = "4vCPU-15GB",
  "4vCPU-16GB" = "4vCPU-16GB",
  "4vCPU-17GB" = "4vCPU-17GB",
  "4vCPU-18GB" = "4vCPU-18GB",
  "4vCPU-19GB" = "4vCPU-19GB",
  "4vCPU-20GB" = "4vCPU-20GB",
  "4vCPU-21GB" = "4vCPU-21GB",
  "4vCPU-22GB" = "4vCPU-22GB",
  "4vCPU-23GB" = "4vCPU-23GB",
  "4vCPU-24GB" = "4vCPU-24GB",
  "4vCPU-25GB" = "4vCPU-25GB",
  "4vCPU-26GB" = "4vCPU-26GB",
  "4vCPU-27GB" = "4vCPU-27GB",
  "4vCPU-28GB" = "4vCPU-28GB",
  "4vCPU-29GB" = "4vCPU-29GB",
  "4vCPU-30GB" = "4vCPU-30GB"
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
