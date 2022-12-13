import { Column, Entity, PrimaryGeneratedColumn, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { SourceType } from './project';

/**
 * @enum
 * Types of credentials to manage internal repositories from Codebuild. Currently only PERSONAL_ACCESS_TOKEN is supported
 * @see https://docs.aws.amazon.com/codebuild/latest/userguide/access-tokens.html
 */
export enum AuthType {
  PERSONAL_ACCESS_TOKEN = 'PERSONAL_ACCESS_TOKEN',
  // OAUTH = 'OAUTH',
  // BASIC_AUTH = 'BASIC_AUTH',
}

/**
 * Table to list and delete the internal credentials used to access internal repositories from Codebuild.
 *
 * @example
 * ```sql TheButton[Manage SourceCredentials for CodeBuild]="Manage SourceCredentials for CodeBuild"
 * SELECT * FROM source_credentials_list WHERE source_type = 'GITHUB';
 * DELETE FROM source_credentials_list WHERE source_type = 'GITHUB';
 * ```
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codebuild-integration.ts#L217
 * @see https://docs.aws.amazon.com/codebuild/latest/userguide/access-tokens.html
 */
@Entity()
export class SourceCredentialsList {
  /**
   * @public
   * AWS ARN to identify the build
   */
  @PrimaryColumn()
  @cloudId
  arn: string;

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
   * Type of authentication provided by this credential
   */
  @Column()
  authType: AuthType;

  /**
   * @public
   * Region for the credential
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

/**
 * Table to create the internal credentials used to access internal repositories from Codebuild.
 *
 * @example
 * ```sql
 * INSERT INTO source_credentials_import (token, source_type, auth_type) VALUES ('<personal_access_token>', 'GITHUB', 'PERSONAL_ACCESS_TOKEN');
 * ```
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codebuild-integration.ts#L161
 * @see https://docs.aws.amazon.com/codebuild/latest/userguide/access-tokens.html
 */
@Entity()
export class SourceCredentialsImport {
  /**
   * @private
   * Auto-incremented ID field for storing credentials
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Token for the specific credential that wants to be created
   */
  @Column()
  token: string;

  /**
   * @public
   * Type of source where this credential will be used
   * TODO implement for BASIC_AUTH with Bitbucket: // @Column() // username: string;
   */
  @Column({
    type: 'enum',
    enum: SourceType,
  })
  sourceType: SourceType;

  /**
   * @public
   * Type of authentication that is used in this credential
   */
  @Column({
    type: 'enum',
    enum: AuthType,
  })
  authType: AuthType;

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
  region: string;
}
