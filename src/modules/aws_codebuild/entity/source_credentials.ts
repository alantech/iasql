import { Column, Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';

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
 * @see https://github.com/iasql/iasql/blob/main/test/modules/aws-codebuild-integration.ts#L217
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
