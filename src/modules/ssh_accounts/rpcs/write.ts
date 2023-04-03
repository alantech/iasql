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
 * Method for writing a text file on a remote server
 *
 * Returns a single record with a `status` column having the value `written` on success
 *
 */
export class SshWriteFileText extends RpcBase {
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
    data: 'text',
  };

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    serverName: string,
    path: string,
    data: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const sshClient: SSH2Promise = await ctx.getSshClient(serverName);
    const filestream = await sshClient.sftp().createWriteStream(path, { encoding: 'utf8', autoClose: false });
    await new Promise((resolve, reject) => {
      filestream.end(data, 'utf8', (err?: Error) => {
        if (err) reject(err);
        resolve(true);
      });
    });
    return [{ status: 'written' }]; // If we reach this path, the promise did not fail
  };

  constructor(module: SshAccounts) {
    super();
    this.module = module;
    super.init();
  }
}
