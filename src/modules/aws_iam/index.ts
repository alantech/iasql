import { ModuleBase } from '../interfaces';
import { AccessKeyMapper, RoleMapper, UserMapper } from './mappers';
import { SetUserPasswordRequestRpc } from './rpcs';
import { AccessKeyRequestRpc } from './rpcs/request';

export class AwsIamModule extends ModuleBase {
  /** @internal */
  role: RoleMapper;

  /** @internal */
  user: UserMapper;

  /** @internal */
  accessKey: AccessKeyMapper;

  /** @internal */
  accessKeyRequest: AccessKeyRequestRpc;

  /** @internal */
  setUserPassword: SetUserPasswordRequestRpc;

  constructor() {
    super();
    // Mappers
    this.role = new RoleMapper(this);
    this.user = new UserMapper(this);
    this.accessKey = new AccessKeyMapper(this);
    // RPCs
    this.accessKeyRequest = new AccessKeyRequestRpc(this);
    this.setUserPassword = new SetUserPasswordRequestRpc(this);
    super.init();
  }
}

/**
 * ## Code examples
 *
 * ### Create an IAM role
 *
 * Install the AWS IAM module
 * ```sql
 * SELECT * FROM iasql_install('aws_iam');
 * ```
 *
 * An AWS IAM role controls the access to the cloud resources that it is associated with via a JSON policy document that is stored in the [`iam_role`](https://dbdocs.io/iasql/iasql?table=iam_role&schema=public&view=table_structure) table.
 * Below we create a role with a policy and apply the change.
 *
 * ```sql TheButton
 * INSERT INTO iam_role (role_name, assume_role_policy_document)
 * VALUES ('ecs-assume-role', '{"Version": "2012-10-17", "Statement": [{"Sid": "", "Effect": "Allow", "Principal": {"Service": "ecs-tasks.amazonaws.com"},"Action": "sts:AssumeRole"}]}');
 * ```
 */
export const awsIamModule = new AwsIamModule();
