import SSH2Promise from 'ssh2-promise';

import { SshAptModule } from '..';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcInput,
  RpcResponseObject,
} from '../../interfaces';

/**
 * Method for updating the apt package list.
 *
 * Returns the stdout of the process on success, and an error on failure
 *
 */
export class AptUpdate extends RpcBase {
  /**
   * @internal
   */
  module: SshAptModule;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  /**
   * @internal
   */
  outputTable = {
    stdout: 'text',
  } as const;
  /**
   * @internal
   */
  inputTable: RpcInput = {
    serverName: 'varchar',
  };

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    serverName: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const sshClient: SSH2Promise = await ctx.getSshClient(serverName);
    return [{ stdout: await sshClient.exec('sudo apt update 2>/dev/null') }];
  };

  constructor(module: SshAptModule) {
    super();
    this.module = module;
    super.init();
  }
}
