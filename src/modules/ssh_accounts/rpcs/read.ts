import { Readable } from 'stream';

import { SshAccounts } from '..';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcResponseObject,
} from '../../interfaces';

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
  /** @internal */
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
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
