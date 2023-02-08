import { Column, Entity, ManyToOne, JoinColumn, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { IamRole } from '../../aws_iam/entity';

/**
 * @enum
 * Different source types for the Codebuild project. Currently only Github and Codepipeline are supported
 * @see https://docs.aws.amazon.com/codebuild/latest/userguide/create-project-console.html#create-project-console-source
 */
export enum SourceType {
  GITHUB = 'GITHUB',
  // CODECOMMIT = 'CODECOMMIT',
  CODEPIPELINE = 'CODEPIPELINE',
  // S3 = 'S3',
  // BITBUCKET = 'BITBUCKET',
  // GITHUB_ENTERPRISE = 'GITHUB_ENTERPRISE',
  NO_SOURCE = 'NO_SOURCE',
}

/**
 * @enum
 * Type of environment vars that can be used in the project. Currently on plaintext vars are supported
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-codebuild/enums/environmentvariabletype.html
 */
export enum EnvironmentVariableType {
  PLAINTEXT = 'PLAINTEXT',
  // PARAMETER_STORE = 'PARAMETER_STORE',
  // SECRETS_MANAGER = 'SECRETS_MANAGER',
}

/**
 * @enum
 * Types of VMs that can be used to build the projects
 * @see https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-compute-types.html
 */
export enum ComputeType {
  BUILD_GENERAL1_SMALL = 'BUILD_GENERAL1_SMALL',
  BUILD_GENERAL1_MEDIUM = 'BUILD_GENERAL1_MEDIUM',
  BUILD_GENERAL1_LARGE = 'BUILD_GENERAL1_LARGE',
  BUILD_GENERAL1_2XLARGE = 'BUILD_GENERAL1_2XLARGE',
}

/**
 * @enum
 * Types of environments that are supported for building projects
 * @see https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-compute-types.html
 */
export enum EnvironmentType {
  ARM_CONTAINER = 'ARM_CONTAINER',
  LINUX_CONTAINER = 'LINUX_CONTAINER',
  LINUX_GPU_CONTAINER = 'LINUX_GPU_CONTAINER',
  WINDOWS_CONTAINER = 'WINDOWS_CONTAINER',
  WINDOWS_SERVER_2019_CONTAINER = 'WINDOWS_SERVER_2019_CONTAINER',
}

/**
 * Table to manage AWS CodeBuild project entities. AWS CodeBuild is a fully managed continuous integration service that
 * compiles source code, runs tests, and produces ready-to-deploy software packages.
 *
 * A build project includes information about how to run a build, including where to get the source code,
 * which build environment to use, which build commands to run, and where to store the build output.
 *
 * A Codebuild project can be created, then successful builds can be triggered for that specific project.
 *
 * @see https://docs.aws.amazon.com/codebuild/latest/userguide/builds-working.html
 *
 * TODO support buildspec file in repo
 */
@Entity()
@Unique('uq_codebuildproject_id_region', ['id', 'region'])
@Unique('uq_codebuildproject_name_region', ['projectName', 'region'])
export class CodebuildProject {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Name for codebuild project
   */
  @Column()
  @cloudId
  projectName: string;

  /**
   * @public
   * AWS ARN for the Codebuild project
   */
  @Column({
    nullable: true,
  })
  arn?: string;

  /**
   * @public
   * Text blob with the content of the BuildSpec for the project
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html
   */
  @Column({
    type: 'text',
    nullable: true,
  })
  buildSpec?: string;

  /**
   * @public
   * Path for the project's source code
   * For a GitHub repository, the HTTPS clone URL with the source code location
   * @see https://docs.aws.amazon.com/codebuild/latest/APIReference/API_ProjectSource.html
   */
  @Column({ nullable: true })
  sourceLocation: string;

  /**
   * @public
   * Base image where to build the project
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html
   */
  @Column({
    default: 'aws/codebuild/standard:6.0',
  })
  image: string;

  /**
   * @public
   * Service role used to manage the CodeBuild project interactions
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/setting-up.html#setting-up-service-role
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
   * Type of compute instance where to build the project
   */
  @Column({
    type: 'enum',
    enum: ComputeType,
    default: ComputeType.BUILD_GENERAL1_SMALL,
  })
  computeType: ComputeType;

  /**
   * @public
   * Type of environment where to build the project
   */
  @Column({
    type: 'enum',
    enum: EnvironmentType,
    default: EnvironmentType.LINUX_CONTAINER,
  })
  environmentType: EnvironmentType;

  /**
   * @public
   * Version identifier for this specific project
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/sample-source-version.html
   */
  @Column({
    nullable: true,
  })
  sourceVersion?: string;

  /**
   * @public
   * Type of source code used in the project
   */
  @Column({
    type: 'enum',
    enum: SourceType,
  })
  sourceType: SourceType;

  /**
   * @public
   * Internal environment variables to pass to the project builds
   * @see https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html
   */
  @Column({
    type: 'simple-json',
    nullable: true,
  })
  environmentVariables?: [{ name: string; value: string; type: EnvironmentVariableType }];

  /**
   * @public
   * Enables running the Docker daemon inside a Docker container. Set to true only if the build project is used to build Docker images. Otherwise, a build that attempts to interact with the Docker daemon fails.
   * The AWS default setting is false.
   */
  @Column({
    type: 'boolean',
    default: true,
  })
  privilegedMode: boolean;

  /**
   * @public
   * Region for the Codebuild project
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
