import SSH2Promise from 'ssh2-promise';

import { SshAccounts } from '..';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcInput,
  RpcResponseObject,
} from '../../interfaces';

/**
 * Method for moving or renaming a file or directory
 *
 * Returns a single record with a `status` column having the value `moved` on success
 *
 */
export class SshMv extends RpcBase {
  /**
   * @internal
   */
  module: SshAccounts;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  /**
   * @internal
   */
  outputTable = {
    status: 'varchar',
  } as const;
  /**
   * @internal
   */
  inputTable: RpcInput = {
    serverName: 'varchar',
    origin: 'varchar',
    destination: 'varchar',
  };

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    serverName: string,
    origin: string,
    destination: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const sshClient: SSH2Promise = await ctx.getSshClient(serverName);
    await sshClient.sftp().rename(origin, destination);
    return [{ status: 'moved' }]; // If it reaches here, it was successful
  };

  constructor(module: SshAccounts) {
    super();
    this.module = module;
    super.init();
  }
}
