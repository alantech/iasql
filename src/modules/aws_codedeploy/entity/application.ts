import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { CodedeployDeploymentGroup } from './deploymentGroup';

/**
 * @enum
 * Compute platform used to deploy applications. Currently Lambda and Server are supported
 * @see https://docs.aws.amazon.com/codedeploy/latest/userguide/welcome.html#compute-platform
 */
export enum ComputePlatform {
  Lambda = 'Lambda',
  Server = 'Server',
}

/**
 * Table to manage AWS CodeDeploy application entities. An application is simply a name or container used
 * by CodeDeploy to ensure that the correct revision, deployment configuration, and deployment group are
 * referenced during a deployment.
 *
 * @example
 * ```sql TheButton[Manage a CodeDeploy app]="Manage a CodeDeploy app"
 * INSERT INTO codedeploy_application (name, compute_platform) VALUES ('application-name', 'Server');
 * SELECT * FROM codedeploy_application WHERE name='application-name';
 * DELETE FROM codedeploy_application WHERE name = 'application-name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codedeploy-integration.ts#L289
 * @see https://docs.aws.amazon.com/codedeploy/latest/userguide/applications-create.html
 *
 */
@Unique('uq_codedeployapp_id_region', ['id', 'region'])
@Unique('uq_codedeployapp_name_region', ['name', 'region'])
@Entity()
export class CodedeployApplication {
  /**
   * @private
   * Auto-incremented ID field for storing builds
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Name for the Codedeploy application
   */
  @Column()
  @cloudId
  name: string;

  /**
   * @public
   * Internal AWS ID for the application
   */
  @Column({
    nullable: true,
  })
  applicationId?: string;

  /**
   * @public
   * Compute platform where the application will run
   */
  @Column({
    type: 'enum',
    enum: ComputePlatform,
    default: ComputePlatform.Server,
  })
  computePlatform: ComputePlatform;

  /**
   * @public
   * Deployment groups attached to this specific application
   * @see https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-groups.html
   */
  @OneToMany(() => CodedeployDeploymentGroup, deploymentGroups => deploymentGroups.application, {
    nullable: true,
    cascade: true,
  })
  deploymentGroups?: CodedeployDeploymentGroup[];

  /**
   * @public
   * Region for the Codedeploy application
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
