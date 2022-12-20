import { Column, CreateDateColumn, Entity, OneToMany, PrimaryColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AccessKey } from './access_key';

/**
 * Table to manage AWS IAM users. An AWS Identity and Access Management (IAM) user is an entity that you create in AWS to represent the person
 * or application that uses it to interact with AWS. A user in AWS consists of a name and credentials.
 *
 * @example
 * ```sql TheButton[Manage an IAM user]="Manage an IAM user"
 * INSERT INTO iam_user (user_name, path, attached_policies_arns) VALUES ('user_name', '/username/',
 * array['arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy']);
 *
 * SELECT * FROM iam_user WHERE user_name = 'user_name';
 *
 * DELETE FROM iam_user WHERE user_name = 'user_name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-iam-integration.ts#L816
 * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html
 *
 * @privateRemarks
 * TODO complete schema
 */

@Entity()
export class IamUser {
  /**
   * @public
   * AWS ARN to identify the user
   */
  @Column({
    nullable: true,
  })
  arn?: string;

  /**
   * @public
   * Name for the user
   * Guaranteed unique in AWS
   * Maximum 128 characters. Use alphanumeric and '+=,.@-_' characters.
   */
  @PrimaryColumn()
  @cloudId
  userName: string;

  /**
   * @public
   * Creation date
   */
  @CreateDateColumn({
    type: 'timestamptz',
  })
  createDate: Date;

  /**
   * @public
   * The path to the user
   * must start and end with /
   * only can contain alphanumeric characters
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html
   */
  @Column({ nullable: true })
  path?: string;

  /**
   * @public
   * AWS generated ID for the user
   */
  @Column({ nullable: true })
  userId?: string;

  /**
   * @public
   * ARN for the policies that are attached to this specific role
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_job-functions_create-policies.html
   */
  @Column({
    type: 'text',
    array: true,
    nullable: true,
  })
  attachedPoliciesArns?: string[];

  /**
   * @public
   * Access Keys associated to an specific user
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
   */
  @OneToMany(() => AccessKey, accessKeys => accessKeys.user, {
    nullable: true,
    cascade: true,
  })
  accessKeys?: AccessKey[];
}
