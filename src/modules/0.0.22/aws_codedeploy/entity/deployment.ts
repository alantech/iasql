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

export enum RevisionType {
  S3 = 'S3',
  GITHUB = 'Github',
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

  @Column({
    nullable: true,
    type: 'enum',
    enum: DeploymentStatusEnum,
  })
  status?: DeploymentStatusEnum;

  @Column({
    nullable: true,
    type: 'json',
  })
  location?: {
    githubLocation?:
      | {
          // the GitHub account and repository pair that stores a reference to the commit that represents the bundled artifacts for the application revision. Specified as account/repository.
          repository?: string | undefined;
          commitId?: string | undefined;
        }
      | undefined;
    revisionType: RevisionType;
    s3Location?:
      | {
          bucket?: string | undefined;
          key?: string | undefined;
          version?: string | undefined;
        }
      | undefined;
  };
}
