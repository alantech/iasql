import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { AwsRegions } from '../../aws_account/entity';
import { IamRole } from '../../aws_iam/entity';
import { CodedeployApplication } from './application';
import { CodedeployDeployment } from './deployment';

/**
 * @enum
 * Set of rules and success and failure conditions used by CodeDeploy during a deployment
 * @see https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-configurations.html
 */
export enum DeploymentConfigType {
  ALL_AT_ONCE = 'CodeDeployDefault.AllAtOnce',
  HALF_AT_A_TIME = 'CodeDeployDefault.HalfAtATime',
  ONE_AT_A_TIME = 'CodeDeployDefault.OneAtATime',
  LAMBDA_CANARY_5 = 'CodeDeployDefault.LambdaCanary10Percent5Minutes',
  LAMBDA_CANARY_10 = 'CodeDeployDefault.LambdaCanary10Percent10Minutes',
  LAMBDA_CANARY_15 = 'CodeDeployDefault.LambdaCanary10Percent15Minutes',
  LAMBDA_CANARY_30 = 'CodeDeployDefault.LambdaCanary10Percent30Minutes',
  LAMBDA_LINEAR_1 = 'CodeDeployDefault.LambdaLinear10Percent1Minute',
  LAMBDA_LINEAR_2 = 'CodeDeployDefault.LambdaLinear10Percent2Minutes',
  LAMBDA_LINEAR_3 = 'CodeDeployDefault.LambdaLinear10Percent3Minutes',
  LAMBDA_LINEAR_10 = 'CodeDeployDefault.LambdaLinear10Percent10Minutes',
  LAMBDA_ALL_AT_ONCE = 'CodeDeployDefault.LambdaAllAtOnce',
}

/**
 * @enum
 * Types of filters used for selecting the target instances to associate with the deployment group
 * @see https://docs.aws.amazon.com/es_es/AWSCloudFormation/latest/UserGuide/aws-properties-codedeploy-deploymentgroup-tagfilter.html
 */
export enum EC2TagFilterType {
  KEY_AND_VALUE = 'KEY_AND_VALUE',
  KEY_ONLY = 'KEY_ONLY',
  VALUE_ONLY = 'VALUE_ONLY',
}

/**
 * @enum
 * Indicates whether to route deployment traffic behind a load balancer.
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-codedeploy/interfaces/deploymentstyle.html#deploymentoption
 */
export enum DeploymentOption {
  WITHOUT_TRAFFIC_CONTROL = 'WITHOUT_TRAFFIC_CONTROL',
  WITH_TRAFFIC_CONTROL = 'WITH_TRAFFIC_CONTROL',
}

/**
 * @enum
 * Indicates whether to run an in-place deployment or a blue/green deployment.
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-codedeploy/interfaces/deploymentstyle.html#deploymenttype
 */
export enum DeploymentType {
  BLUE_GREEN = 'BLUE_GREEN',
  IN_PLACE = 'IN_PLACE',
}

/**
 * Table to manage AWS CodeDeploy deployment group entities. You can specify one or more deployment groups
 * for a CodeDeploy application. Each application deployment uses one of its deployment groups.
 * The deployment group contains settings and configurations used during the deployment.
 *
 * @example
 * ```sql TheButton[Manage CodeDeploy deployment groups]="Manage CodeDeploy deployment groups"
 * INSERT INTO codedeploy_deployment_group (application_id, name, role_name) VALUES
 * ((SELECT id FROM codedeploy_application WHERE name = 'application-name'), 'deployment-group-name', 'role-name');
 *
 * SELECT * FROM codedeploy_deployment_group WHERE name='deployment-group-name';
 *
 * DELETE FROM codedeploy_deployment_group WHERE name = 'deployment-group-name'
 * ```
 *
 * @see https://github.com/iasql/iasql/blob/main/test/modules/aws-codedeploy-integration.ts#L419
 * @see https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-groups.html
 *
 */
@Unique('uq_codedeploydeploymentgroup_id_region', ['id', 'region'])
@Unique('uq_codedeploydeploymentgroup_name_region', ['name', 'region'])
@Entity()
export class CodedeployDeploymentGroup {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Name for the Codedeploy deployment group
   */
  @Column()
  name: string;

  /**
   * @public
   * AWS generated ID for the deployment group
   */
  @Column({
    nullable: true,
  })
  deploymentGroupId?: string;

  /**
   * @public
   * Reference for the application to where this deployment group belongs
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
   * Deployment model to follow
   */
  @Column({
    type: 'enum',
    enum: DeploymentConfigType,
    default: DeploymentConfigType.ONE_AT_A_TIME,
  })
  deploymentConfigName: DeploymentConfigType;

  /**
   * @public
   * Information about the type of deployment, in-place or blue/green, that you want to run and whether to route deployment traffic behind a load balancer.
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  deploymentStyle?: {
    deploymentOption?: DeploymentOption | undefined;
    deploymentType?: DeploymentType | undefined;
  };

  /**
   * @public
   * Complex type used to filter the instances where the application will be deployed
   * @see https://docs.aws.amazon.com/codedeploy/latest/userguide/instances-tagging.html
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  ec2TagFilters?: {
    Key: string | undefined;
    Type: EC2TagFilterType;
    Value: string | undefined;
  }[];

  /**
   * @public
   * Reference for the AWS role used by this deployment group
   */
  @ManyToOne(() => IamRole, role => role.roleName, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({
    name: 'role_name',
  })
  role?: IamRole;

  /**
   * @public
   * List of the current deployments associated to this group
   */
  @OneToMany(() => CodedeployDeployment, deployments => deployments.deploymentGroup, {
    nullable: true,
    cascade: true,
  })
  deployments?: CodedeployDeployment[];

  /**
   * @public
   * Region for the Codedeploy deployment group
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;
}
