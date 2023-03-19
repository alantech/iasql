import { SshAccounts } from '..';
import { Context, RpcBase, RpcInput, RpcResponseObject } from '../../interfaces';

export class SshExec extends RpcBase {
  /**
   * @internal
   */
  module: SshAccounts;
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
    command: 'varchar',
  };

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    serverName: string,
    command: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const sshClient = await ctx.getSshClient(serverName);
    return [{ stdout: await sshClient.exec(command) }];
  };

  constructor(module: SshAccounts) {
    super();
    this.module = module;
    super.init();
  }
}
