import {
  Column,
  Entity,
  OneToMany,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ContainerDefinition } from '.';
import { cloudId, } from '../../../../services/cloud-id'
import { Role, } from '../../aws_iam/entity';

export enum TaskDefinitionStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE"
}

export enum CpuMemCombination {
  "vCPU0.25-0.5GB" = "vCPU0.25-0.5GB",
  "vCPU0.25-1GB" = "vCPU0.25-1GB",
  "vCPU0.25-2GB" = "vCPU0.25-2GB",
  "vCPU0.5-1GB" = "vCPU0.5-1GB",
  "vCPU0.5-2GB" = "vCPU0.5-2GB",
  "vCPU0.5-3GB" = "vCPU0.5-3GB",
  "vCPU0.5-4GB" = "vCPU0.5-4GB",
  "vCPU1-2GB" = "vCPU1-2GB",
  "vCPU1-3GB" = "vCPU1-3GB",
  "vCPU1-4GB" = "vCPU1-4GB",
  "vCPU1-5GB" = "vCPU1-5GB",
  "vCPU1-6GB" = "vCPU1-6GB",
  "vCPU1-7GB" = "vCPU1-7GB",
  "vCPU1-8GB" = "vCPU1-8GB",
  "vCPU2-4GB" = "vCPU2-4GB",
  "vCPU2-5GB" = "vCPU2-5GB",
  "vCPU2-6GB" = "vCPU2-6GB",
  "vCPU2-7GB" = "vCPU2-7GB",
  "vCPU2-8GB" = "vCPU2-8GB",
  "vCPU2-9GB" = "vCPU2-9GB",
  "vCPU2-10GB" = "vCPU2-10GB",
  "vCPU2-11GB" = "vCPU2-11GB",
  "vCPU2-12GB" = "vCPU2-12GB",
  "vCPU2-13GB" = "vCPU2-13GB",
  "vCPU2-14GB" = "vCPU2-14GB",
  "vCPU2-15GB" = "vCPU2-15GB",
  "vCPU2-16GB" = "vCPU2-16GB",
  "vCPU4-8GB" = "vCPU4-8GB",
  "vCPU4-9GB" = "vCPU4-9GB",
  "vCPU4-10GB" = "vCPU4-10GB",
  "vCPU4-11GB" = "vCPU4-11GB",
  "vCPU4-12GB" = "vCPU4-12GB",
  "vCPU4-13GB" = "vCPU4-13GB",
  "vCPU4-14GB" = "vCPU4-14GB",
  "vCPU4-15GB" = "vCPU4-15GB",
  "vCPU4-16GB" = "vCPU4-16GB",
  "vCPU4-17GB" = "vCPU4-17GB",
  "vCPU4-18GB" = "vCPU4-18GB",
  "vCPU4-19GB" = "vCPU4-19GB",
  "vCPU4-20GB" = "vCPU4-20GB",
  "vCPU4-21GB" = "vCPU4-21GB",
  "vCPU4-22GB" = "vCPU4-22GB",
  "vCPU4-23GB" = "vCPU4-23GB",
  "vCPU4-24GB" = "vCPU4-24GB",
  "vCPU4-25GB" = "vCPU4-25GB",
  "vCPU4-26GB" = "vCPU4-26GB",
  "vCPU4-27GB" = "vCPU4-27GB",
  "vCPU4-28GB" = "vCPU4-28GB",
  "vCPU4-29GB" = "vCPU4-29GB",
  "vCPU4-30GB" = "vCPU4-30GB"
}

@Entity()
export class TaskDefinition {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true,
  })
  @cloudId
  taskDefinitionArn?: string;

  @Column()
  family: string;

  @Column({
    nullable: true,
    type: 'int',
  })
  revision?: number;

  @ManyToOne(() => Role, { nullable: true, eager: true })
  @JoinColumn({
    name: 'task_role_name',
  })
  taskRole?: Role;

  @ManyToOne(() => Role, { nullable: true, eager: true })
  @JoinColumn({
    name: 'execution_role_name',
  })
  executionRole?: Role;

  @Column({
    nullable: true,
    type: 'enum',
    enum: TaskDefinitionStatus,
  })
  status?: TaskDefinitionStatus;

  @Column({
    nullable: true,
    type: 'enum',
    enum: CpuMemCombination,
  })
  cpuMemory: CpuMemCombination;

  @OneToMany(() => ContainerDefinition, c => c.taskDefinition, {
    eager: true,
    cascade: true
  })
  containerDefinitions: ContainerDefinition[];
}
