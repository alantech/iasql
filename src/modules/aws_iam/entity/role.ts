import { Column, Entity, PrimaryColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';

/**
 * Table to manage AWS IAM roles. An IAM role is an IAM identity that you can create in your account that has specific permissions.
 *
 * An IAM role is similar to an IAM user, in that it is an AWS identity with permission policies that determine what the identity can and cannot do in AWS.
 * However, instead of being uniquely associated with one person, a role is intended to be assumable by anyone who needs it.
 *
 * Also, a role does not have standard long-term credentials such as a password or access keys associated with it.
 * Instead, when you assume a role, it provides you with temporary security credentials for your role session.
 *
 * @example
 * ```sql TheButton[Manage an IAM role]="Manage an IAM role"
 * INSERT INTO iam_role (role_name, assume_role_policy_document) VALUES ('lambda_role_name', '{
 * Version: '2012-10-17',
 * Statement: [
 *   {
 *     Effect: 'Allow',
 *     Principal: {
 *       Service: 'lambda.amazonaws.com',
 *     },
 *     Action: 'sts:AssumeRole',
 *   },
 * ],
 * }');
 *
 * SELECT * FROM iam_role WHERE role_name = 'lambda_role_name';
 *
 * DELETE FROM iam_role WHERE role_name = 'lambda_role_name';
 * ```
 *
 * @see https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-iam-integration.ts#L183
 * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html
 *
 * @privateRemarks
 * TODO complete schema
 */
@Entity()
export class IamRole {
  /**
   * @public
   * AWS ARN to identify the role
   */
  @Column({
    nullable: true,
  })
  arn?: string;

  /**
   * @public
   * Name for the role
   * Guaranteed unique in AWS
   * Maximum 128 characters. Use alphanumeric and '+=,.@-_' characters.
   */
  @PrimaryColumn()
  @cloudId
  roleName: string;

  /**
   * @public
   * JSON blob to define the policy for the role
   * Returns a set of temporary security credentials that you can use to access AWS resources that you might not normally have access to.
   * @see https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
   */
  @Column({
    type: 'jsonb',
  })
  assumeRolePolicyDocument: { [key: string]: any };

  /**
   * @public
   * Description for the role
   */
  @Column({
    nullable: true,
  })
  description?: string;

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
}
