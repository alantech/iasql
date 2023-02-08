import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { CodedeployApplication } from './application';
import { CodedeployDeploymentGroup } from './deploymentGroup';

/**
 * @enum
 * Status of the current deployment
 * @see https://docs.aws.amazon.com/codedeploy/latest/APIReference/API_DeploymentInfo.html
 */
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

/**
 * @enum
 * Type of source code where to get the application configuration. Currently S3 and Github are supported
 */
export enum RevisionType {
  S3 = 'S3',
  GITHUB = 'GitHub',
}

/**
 * Table to list existing AWS CodeDeploy deployments. A deployment is the process, and the components involved in the process,
 * of installing content on one or more instances.
 *
 * @see https://docs.aws.amazon.com/codedeploy/latest/userguide/deployments.html
 *
 */
@Unique('uq_codedeploydeployment_id_region', ['id', 'region'])
@Unique('uq_codedeploydeployment_deploymentid_region', ['deploymentId', 'region'])
@Entity()
export class CodedeployDeployment {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Internal AWS ID for the deployment
   */
  @Column({
    nullable: true,
    unique: true,
  })
  @cloudId
  deploymentId?: string;

  /**
   * @public
   * Reference for the application to where the deployment belongs
   */
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

  /**
   * @public
   * Reference for the deployment group to where the deployment belongs
   */
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

  /**
   * @public
   * Description to identify the deployment group
   */
  @Column({
    nullable: true,
  })
  description?: string;

  /**
   * @public
   * The unique ID for an external resource (for example, a CloudFormation stack ID) that is linked to this deployment.
   * @see https://docs.aws.amazon.com/codedeploy/latest/APIReference/API_DeploymentInfo.html
   */
  @Column({
    nullable: true,
  })
  externalId?: string;

  /**
   * @public
   * Current status of the deployment
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: DeploymentStatusEnum,
  })
  status?: DeploymentStatusEnum;

  /**
   * @public
   * Complex type to identified the location used by the deployment. It has specific configurations
   * for Github or S3
   * @see https://docs.aws.amazon.com/codedeploy/latest/APIReference/API_RevisionLocation.html
   */
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

  /**
   * @public
   * Region for the Codedeploy deployment
   */
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
