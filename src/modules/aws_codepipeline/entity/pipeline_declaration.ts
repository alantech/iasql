import { Column, Entity, ManyToOne, JoinColumn, Unique, PrimaryGeneratedColumn } from 'typeorm';

import { ArtifactStore, StageDeclaration } from '@aws-sdk/client-codepipeline';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { IamRole } from '../../aws_iam/entity';

/**
 * @enum
 * Types of actions that a pipeline can perform
 * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/reference-pipeline-structure.html
 */
export enum ActionCategory {
  Approval = 'Approval',
  Build = 'Build',
  Deploy = 'Deploy',
  Invoke = 'Invoke',
  Source = 'Source',
  Test = 'Test',
}

/**
 * Table to manage AWS Codepipeline entities. AWS CodePipeline is a continuous delivery service you can
 * use to model, visualize, and automate the steps required to release your software.
 *
 * @example
 * ```sql TheButton[Create a new CodePipeline declaration]="Create a new CodePipeline declaration"
 * INSERT INTO pipeline_declaration (name, service_role_name, stages, artifact_store)
 * VALUES ('pipeline-name', 'pipeline-role', "{
 *  name: 'Source',
 *   actions: [
 *     {
 *       name: 'SourceAction',
 *       actionTypeId: {
 *         category: 'Source',
 *         owner: 'ThirdParty',
 *         version: '1',
 *         provider: 'GitHub',
 *       },
 *       configuration: {
 *         Owner: 'iasql',
 *         Repo: 'iasql-codedeploy-example',
 *         Branch: 'main',
 *         OAuthToken: `<personal_access_token>`,
 *       },
 *       outputArtifacts: [
 *         {
 *           name: 'Source',
 *         },
 *       ],
 *     },
 *   ],
 * },
 * {
 *   name: 'Deploy',
 *   actions: [
 *     {
 *       name: 'DeployApp',
 *       actionTypeId: {
 *         category: 'Deploy',
 *         owner: 'AWS',
 *         version: '1',
 *         provider: 'CodeDeploy',
 *       },
 *       configuration: {
 *         ApplicationName: `target-application`,
 *         DeploymentGroupName: `deployment-group`,
 *       },
 *       inputArtifacts: [
 *         {
 *           name: 'Source',
 *         },
 *       ],
 *     },
 *   ],
 * },',
 * '{ type: 'S3', location: 's3-bucket' }'");
 * ```
 *
 * @see https://github.com/iasql/iasql/blob/main/test/modules/aws-codepipeline-integration.ts#L424
 * @see https://docs.aws.amazon.com/codepipeline/latest/userguide/welcome.html
 *
 */
@Entity()
@Unique('uq_pipeline_name_region', ['name', 'region'])
export class PipelineDeclaration {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Name for the Codedeploy pipeline declaration
   */
  @Column({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  name: string;

  /**
   * @public
   * Complex type used to specify the storage for the produced artifacts
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-codepipeline/modules/artifactstore.html
   */
  @Column({
    type: 'json',
    nullable: false,
  })
  artifactStore: ArtifactStore;

  /**
   * @public
   * Reference for the AWS role used by this deployment group
   */
  @ManyToOne(() => IamRole, {
    eager: true,
  })
  @JoinColumn({
    name: 'service_role_name',
  })
  serviceRole: IamRole;

  /**
   * @public
   * Complex type used to specify all the stages for this pipeline
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-codepipeline/modules/stagedeclaration.html
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  stages?: StageDeclaration[] | undefined;

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
  @cloudId
  region: string;
}
