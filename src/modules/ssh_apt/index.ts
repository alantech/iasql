import { ModuleBase } from '../interfaces';
import { PackageMapper } from './mappers';

export class SshAptModule extends ModuleBase {
  package: PackageMapper;

  constructor() {
    super();
    // mappers
    this.package = new PackageMapper(this);
    // rpcs
    // TODO
    super.init();
  }
}

export const sshApt = new SshAptModule();
