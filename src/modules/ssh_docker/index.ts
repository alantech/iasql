import { ModuleBase } from '../interfaces';
import { DockerContainerMapper } from './mappers';

export class SshDocker extends ModuleBase {
  /** @internal */
  dockerContainer: DockerContainerMapper;

  constructor() {
    super();
    this.dockerContainer = new DockerContainerMapper(this);
    super.init();
  }
}

/**
 *
 * ```testdoc
 * modules/ssh-docker-integration.ts#SSH Docker Integration Testing
 * ```
 */
export const sshDocker = new SshDocker();
