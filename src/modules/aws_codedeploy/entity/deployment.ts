import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { CodedeployApplication } from './application';
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
  GITHUB = 'GitHub',
}

@Unique('uq_codedeploydeployment_id_region', ['id', 'region'])
@Unique('uq_codedeploydeployment_deploymentid_region', ['deploymentId', 'region'])
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
  @JoinColumn([
    {
      name: 'application_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  application: CodedeployApplication;

  @ManyToOne(() => CodedeployDeploymentGroup, {
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn([
    {
      name: 'deployment_group_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
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
        }
      | undefined;
  };

  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;
}
