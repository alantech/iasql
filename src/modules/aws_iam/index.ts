import { ModuleBase } from '../interfaces';
import { RoleMapper, UserMapper } from './mappers';

export class AwsIamModule extends ModuleBase {
  /** @internal */
  role: RoleMapper;

  /** @internal */
  user: UserMapper;

  constructor() {
    super();
    this.role = new RoleMapper(this);
    this.user = new UserMapper(this);
    super.init();
  }
}
export const awsIamModule = new AwsIamModule();
