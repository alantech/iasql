import SSH2Promise from 'ssh2-promise';

import { SshAccounts } from '..';
import {
  Context,
  RpcBase,
  RpcInput,
  RpcResponseObject,
  PreTransactionCheck,
  PostTransactionCheck,
} from '../../interfaces';

/**
 * Method for creating a directory on a remote server
 *
 * Returns a single record with a `status` column having the value `created` on success
 *
 */
export class SshMkdir extends RpcBase {
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
    path: 'varchar',
  };

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    serverName: string,
    path: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const sshClient: SSH2Promise = await ctx.getSshClient(serverName);
    await sshClient.sftp().mkdir(path);
    return [{ status: 'created' }]; // If it reaches here, it was successful
  };

  constructor(module: SshAccounts) {
    super();
    this.module = module;
    super.init();
  }
}
