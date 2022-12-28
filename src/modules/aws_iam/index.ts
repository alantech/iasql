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
    this.role = new RoleMapper(this);
    this.user = new UserMapper(this);
    this.accessKey = new AccessKeyMapper(this);
    this.accessKeyRequest = new AccessKeyRequestRpc(this);
    this.setUserPassword = new SetUserPasswordRequestRpc(this);
    super.init();
  }
}
export const awsIamModule = new AwsIamModule();
