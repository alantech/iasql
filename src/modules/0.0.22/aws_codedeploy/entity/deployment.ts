import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { CodedeployApplication, ComputePlatform } from './application';
import { CodedeployDeploymentGroup } from './deploymentGroup';
import { CodedeployRevision } from './revision';

export enum DeploymentStatusEnum {
  BAKING = 'Baking',
  CREATED = 'Created',
  FAILED = 'Failed',
  IN_PROGRESS = 'InProgress',
  QUEUED = 'Queued',
  READY = 'Ready',
  STOPPED = 'Stopped',
  SUCCEEDED = 'Succeeded',
}

@Entity()
export class CodedeployDeployment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
    unique: true,
  })
  @cloudId
  deploymentId?: string;

  @ManyToOne(() => CodedeployApplication, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({
    name: 'application_name',
  })
  application: CodedeployApplication;

  @ManyToOne(() => CodedeployDeploymentGroup, {
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'deployment_group_name',
  })
  deploymentGroup: CodedeployDeploymentGroup;

  @Column({
    nullable: true,
  })
  description?: string;

  @Column({
    nullable: true,
  })
  externalId?: string;

  @OneToOne(() => CodedeployRevision, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({
    name: 'revision_id',
  })
  revision?: CodedeployRevision;

  @Column({
    nullable: true,
    type: 'enum',
    enum: DeploymentStatusEnum,
  })
  status?: DeploymentStatusEnum;
}
