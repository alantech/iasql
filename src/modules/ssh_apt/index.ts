import { ModuleBase } from '../interfaces';
import { PackageMapper } from './mappers';
import { AptUpdate } from './rpcs';

export class SshAptModule extends ModuleBase {
  package: PackageMapper;
  aptUpdate: AptUpdate;

  constructor() {
    super();
    // mappers
    this.package = new PackageMapper(this);
    // rpcs
    this.aptUpdate = new AptUpdate(this);
    super.init();
  }
}


/**
 *
 * ```testdoc
 * modules/ssh-apt-integration.ts#SSH Apt Package Management Integration Testing
 * ```
 */
export const sshApt = new SshAptModule();
