import SSH2Promise from 'ssh2-promise';
import { Readable } from 'stream';

import {
  Context,
  Crud,
  MapperBase,
  ModuleBase,
  PartialContext,
  RpcBase,
  RpcInput,
  RpcResponseObject,
} from '../interfaces';
import { SshCredentials } from './entity';

class CredentialsMapper extends MapperBase<SshCredentials> {
  module: SshAccounts;
  entity = SshCredentials;
  equals = (_a: SshCredentials, _b: SshCredentials) => true;
  cloud = new Crud<SshCredentials>({
    create: async (_e: SshCredentials[], _ctx: Context) => {
      /* Do nothing */
    },
    read: (ctx: Context, name?: string) =>
      ctx.orm.find(
        SshCredentials,
        name
          ? {
              where: {
                name,
              },
            }
          : undefined,
      ),
    update: async (_e: SshCredentials[], _ctx: Context) => {
      /* Do nothing */
    },
    delete: async (_e: SshCredentials[], _ctx: Context) => {
      /* Do nothing */
    },
  });

  constructor(module: SshAccounts) {
    super();
    this.module = module;
    super.init();
  }
}

class SshLs extends RpcBase {
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

class SshReadFileText extends RpcBase {
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

class SshWriteFileText extends RpcBase {
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

class SshAccounts extends ModuleBase {
  context: PartialContext = {
    // This function is `async function () {` instead of `async () => {` because that enables the
    // `this` keyword within the function based on the object it is being called from, so the
    // `getAwsClient` function can access the correct `orm` object with the appropriate creds and
    // read out the right AWS creds and create an AWS client also attached to the current context,
    // which will be different for different users. The client cache is based on the region chosen,
    // and it assumes that the credentials do not change mid-operation.
    async getSshClient(serverName: string) {
      if (this.sshClients[serverName]) return this.sshClients[serverName];
      const orm = this.orm;
      const creds = await orm.findOne(SshCredentials, {
        where: {
          name: serverName,
        },
      });
      if (!creds) throw new Error('No credentials found');
      this.sshClients[serverName] = new SSH2Promise({
        host: creds.hostname,
        port: creds.port,
        username: creds.username,
        privateKey: creds.privateKey,
        passphrase: creds.keyPassphrase,
      });
      return this.sshClients[serverName];
    },
    sshClients: {}, // Initializing this cache with no clients. The cache doesn't expire explicitly
    // as we simply drop the context at the end of the execution.
    // This function returns the list of regions that are currently enabled, allowing multi-region
    // aware modules to request which regions they should operate on beyond the default region. The
    // full AwsRegions entities may be optionally returned if there is some special logic involving
    // the default region, perhaps, that is desired.
  };
  sshCredentials: CredentialsMapper;
  sshLs: SshLs;
  sshReadFileText: SshReadFileText;
  sshWriteFileText: SshWriteFileText;

  constructor() {
    super();
    this.sshCredentials = new CredentialsMapper(this);
    this.sshLs = new SshLs(this);
    this.sshReadFileText = new SshReadFileText(this);
    this.sshWriteFileText = new SshWriteFileText(this);
    super.init();
  }
}

export const sshAccounts = new SshAccounts();
