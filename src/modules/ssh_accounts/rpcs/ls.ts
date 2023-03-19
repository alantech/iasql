import { SshAccounts } from '..';
import { Context, RpcBase, RpcInput, RpcResponseObject } from '../../interfaces';

export class SshLs extends RpcBase {
  /**
   * @internal
   */
  module: SshAccounts;
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
    const sshClient = await ctx.getSshClient(serverName);
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
