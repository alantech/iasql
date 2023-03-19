import { Readable } from 'stream';

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

// From https://stackoverflow.com/questions/10623798/how-do-i-read-the-contents-of-a-node-js-stream-into-a-string-variable#49428486
function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err: Error) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

export class SshReadFileText extends RpcBase {
  /**
   * @internal
   */
  module: SshAccounts;
  /**
   * @internal
   */
  outputTable = {
    path: 'varchar',
    data: 'text',
  } as const;

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    serverName: string,
    ...paths: string[]
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const sshClient = await ctx.getSshClient(serverName);
    const out = [];
    for (const path of paths) {
      const filestream = await sshClient.sftp().createReadStream(path, { encoding: 'utf8' });
      const data = await streamToString(filestream);
      out.push({
        path,
        data,
      });
    }
    return out;
  };

  constructor(module: SshAccounts) {
    super();
    this.module = module;
    super.init();
  }
}

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

export class SshRm extends RpcBase {
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
  };

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    serverName: string,
    path: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const sshClient = await ctx.getSshClient(serverName);
    await sshClient.sftp().unlink(path);
    return [{ status: 'deleted' }]; // If it reaches here, it was successful
  };

  constructor(module: SshAccounts) {
    super();
    this.module = module;
    super.init();
  }
}
