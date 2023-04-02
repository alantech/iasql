import SSH2Promise from 'ssh2-promise';

import { Context, Crud, MapperBase, ModuleBase, PartialContext } from '../interfaces';
import { SshCredentials } from './entity';
import { SshLs, SshReadFileText, SshWriteFileText, SshRm, SshMkdir, SshRmdir, SshMv, SshExec } from './rpcs';

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

export class SshAccounts extends ModuleBase {
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
    // Returns all of the server names in the database
    async getServerNames() {
      const creds = await this.orm.find(SshCredentials, {});
      return creds.map((c: SshCredentials) => c.name);
    },
    sshClients: {}, // Initializing this cache with no clients. The cache doesn't expire explicitly
    // as we simply drop the context at the end of the execution.
    // This function returns the list of regions that are currently enabled, allowing multi-region
    // aware modules to request which regions they should operate on beyond the default region. The
    // full AwsRegions entities may be optionally returned if there is some special logic involving
    // the default region, perhaps, that is desired.
  };
  sshCredentials: CredentialsMapper;
  sshExec: SshExec;
  sshLs: SshLs;
  sshMkdir: SshMkdir;
  sshMv: SshMv;
  sshReadFileText: SshReadFileText;
  sshRm: SshRm;
  sshRmdir: SshRmdir;
  sshWriteFileText: SshWriteFileText;

  constructor() {
    super();
    this.sshCredentials = new CredentialsMapper(this);
    this.sshExec = new SshExec(this);
    this.sshLs = new SshLs(this);
    this.sshMkdir = new SshMkdir(this);
    this.sshMv = new SshMv(this);
    this.sshReadFileText = new SshReadFileText(this);
    this.sshRm = new SshRm(this);
    this.sshRmdir = new SshRmdir(this);
    this.sshWriteFileText = new SshWriteFileText(this);
    super.init();
  }
}

/**
 *
 * ```testdoc
 * modules/ssh-accounts-integration.ts#SSH Accounts Integration Testing
 * ```
 */
export const sshAccounts = new SshAccounts();
