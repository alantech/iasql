import { SshAccounts } from '..';
import { Context, RpcBase, RpcInput, RpcResponseObject } from '../../interfaces';

export class SshWriteFileText extends RpcBase {
  /**
   * @internal
   */
  module: SshAccounts;
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
    const sshClient = await ctx.getSshClient(serverName);
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
