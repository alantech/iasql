import { Column, Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { Role } from '../../aws_iam/entity/role';

export enum SourceType {
  GITHUB = 'GITHUB',
  // CODECOMMIT = 'CODECOMMIT',
  // CODEPIPELINE = 'CODEPIPELINE',
  // S3 = 'S3',
  // BITBUCKET = 'BITBUCKET',
  // GITHUB_ENTERPRISE = 'GITHUB_ENTERPRISE',
  // NO_SOURCE = 'NO_SOURCE'
}

export enum EnvironmentVariableType {
  PLAINTEXT = 'PLAINTEXT',
  // PARAMETER_STORE = 'PARAMETER_STORE',
  // SECRETS_MANAGER = 'SECRETS_MANAGER',
}

// https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-compute-types.html
export enum ComputeType {
  BUILD_GENERAL1_SMALL = 'BUILD_GENERAL1_SMALL',
  BUILD_GENERAL1_MEDIUM = 'BUILD_GENERAL1_MEDIUM',
  BUILD_GENERAL1_LARGE = 'BUILD_GENERAL1_LARGE',
  BUILD_GENERAL1_2XLARGE = 'BUILD_GENERAL1_2XLARGE',
}
export enum EnvironmentType {
  ARM_CONTAINER = 'ARM_CONTAINER',
  LINUX_CONTAINER = 'LINUX_CONTAINER',
  LINUX_GPU_CONTAINER = 'LINUX_GPU_CONTAINER',
  WINDOWS_CONTAINER = 'WINDOWS_CONTAINER',
  WINDOWS_SERVER_2019_CONTAINER = 'WINDOWS_SERVER_2019_CONTAINER',
}

// TODO support buildspec file in repo
@Entity()
export class CodebuildProject {
  @PrimaryColumn()
  @cloudId
  projectName: string;

  @Column({
    nullable: true,
  })
  arn?: string;

  // https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html
  @Column({
    type: 'text',
    nullable: true,
  })
  buildSpec?: string;

  // For a GitHub repository, the HTTPS clone URL with the source code location
  @Column()
  sourceLocation: string;

  @Column({
    default: 'aws/codebuild/standard:6.0',
  })
  image: string;

  @ManyToOne(() => Role, {
    eager: true,
  })
  @JoinColumn({
    name: 'service_role_name',
  })
  serviceRole: Role;

  @Column({
    type: 'enum',
    enum: ComputeType,
    default: ComputeType.BUILD_GENERAL1_SMALL,
  })
  computeType: ComputeType;

  @Column({
    type: 'enum',
    enum: EnvironmentType,
    default: EnvironmentType.LINUX_CONTAINER,
  })
  environmentType: EnvironmentType;

  // https://docs.aws.amazon.com/codebuild/latest/userguide/sample-source-version.html
  @Column({
    nullable: true,
  })
  sourceVersion?: string;

  @Column({
    type: 'enum',
    enum: SourceType,
  })
  sourceType: SourceType;

  @Column({
    type: 'simple-json',
    nullable: true,
  })
  environmentVariables?: [{ name: string; value: string; type: EnvironmentVariableType }];

  // Enables running the Docker daemon inside a Docker container. Set to true only if the build project is used to build Docker images. Otherwise, a build that attempts to interact with the Docker daemon fails. The AWS default setting is false.
  @Column({
    type: 'boolean',
    default: true,
  })
  privilegedMode: boolean;
}
