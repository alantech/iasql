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
 * ```testdoc
 * modules/aws-iam-integration.ts#IAM Role Integration Testing#Code examples
 * ```
 */
export const awsIamModule = new AwsIamModule();
