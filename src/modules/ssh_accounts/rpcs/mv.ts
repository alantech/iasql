import { SshAccounts } from '..';
import { Context, RpcBase, RpcInput, RpcResponseObject } from '../../interfaces';

export class SshMv extends RpcBase {
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
    const sshClient = await ctx.getSshClient(serverName);
    await sshClient.sftp().rename(origin, destination);
    return [{ status: 'moved' }]; // If it reaches here, it was successful
  };

  constructor(module: SshAccounts) {
    super();
    this.module = module;
    super.init();
  }
}
