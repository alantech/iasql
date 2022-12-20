import { ModuleBase } from '../interfaces';
import { AccessKeyMapper, RoleMapper, UserMapper } from './mappers';

export class AwsIamModule extends ModuleBase {
  /** @internal */
  role: RoleMapper;

  /** @internal */
  user: UserMapper;

  /** @internal */
  accessKey: AccessKeyMapper;

  constructor() {
    super();
    this.role = new RoleMapper(this);
    this.user = new UserMapper(this);
    this.accessKey = new AccessKeyMapper(this);
    super.init();
  }
}
export const awsIamModule = new AwsIamModule();
