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
 * Method for listing the contents of a directory on a remote server
 *
 * Returns the following columns:
 *
 * - filename: The name of the file in question
 *
 * - permissions: A text representation of file permissions
 *
 * - link_count: The number of hard links on the file system for the file in question
 *
 * - owner_name: The server user that owns the file
 *
 * - group_name: The server group that has access to the file
 *
 * - size_bytes: The size of the file in bytes
 *
 * - attrs: A JSON blob of various attributes, with overlap of the prior columns
 *
 */
export class SshLs extends RpcBase {
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
    filename: 'varchar',
    permissions: 'varchar',
    link_count: 'integer',
    owner_name: 'varchar',
    group_name: 'varchar',
    size_bytes: 'integer',
    attrs: 'json',
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
    return (await sshClient.sftp().readdir(path)).map(
      (r: { filename: string; longname: string; attrs: { [key: string]: any } }) => {
        const parts = r.longname.split(/ +/);
        return {
          filename: r.filename,
          permissions: parts[0],
          link_count: parseInt(parts[1], 10),
          owner_name: parts[2],
          group_name: parts[3],
          size_bytes: parseInt(parts[4], 10),
          attrs: r.attrs,
        };
      },
    );
  };

  constructor(module: SshAccounts) {
    super();
    this.module = module;
    super.init();
  }
}
