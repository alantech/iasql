import { SshAptModule } from '..';
import { Context, Crud, MapperBase } from '../../interfaces';
import { Package } from '../entity';

export class PackageMapper extends MapperBase<Package> {
  module: SshAptModule;
  entity = Package;

  equals = (a: Package, b: Package) =>
    Object.is(a.server, b.server) &&
    Object.is(a.package, b.package) &&
    Object.is(a.version, b.version) &&
    Object.is(a.architecture, b.architecture) &&
    Object.is(a.description, b.description) &&
    Object.is(a.installed, b.installed) &&
    Object.is(a.upgradable, b.upgradable);

  cloud = new Crud<Package>({
    create: async (es: Package[], ctx: Context) => {
      // Users cannot create packages, only install packages provided by their sources, so simply
      // delete these records
      const out = await this.module.package.db.delete(es, ctx);
      if (Array.isArray(out) || !out) return out;
      return [out];
    },
    read: async (ctx: Context, id?: string) => {
      if (id) {
        // There's no good way to read a single value, so we're going to read *all the things*
        // and then filter out the desired record
        const packages: Package[] = (await this.module.package.cloud.read(ctx)) ?? [];
        const { server, package: deb, version, architecture } = this.idFields(id);
        return packages.find(
          (p: Package) =>
            p.server === server &&
            p.package === deb &&
            p.version === version &&
            p.architecture === architecture,
        );
      }
      const servers = await ctx.getServerNames();
      const clientsAndServers = await Promise.all(
        servers.map(async (s: string) => ({
          server: s,
          client: await ctx.getSshClient(s),
        })),
      );
      const out: Package[] = [];
      await Promise.all(
        clientsAndServers.map(async clientAndServer => {
          const { client, server } = clientAndServer;
          const allPackages = (await client.exec('sudo apt list --all-versions --verbose 2>/dev/null | cat'))
            .split('\n')
            .slice(1)
            .filter((line: string) => !!line)
            .map((line: string) => line.trim());
          const installedPackages = (await client.exec('sudo apt list --installed 2>/dev/null | cat'))
            .split('\n')
            .slice(1)
            .filter((line: string) => !!line);
          const upgradablePackages = (await client.exec('sudo apt list --upgradable 2>/dev/null | cat'))
            .split('\n')
            .slice(1)
            .filter((line: string) => !!line);
          const packagesObj: { [key: string]: Package } = {};
          for (let i = 0; i < allPackages.length; i += 2) {
            const mainLine = allPackages[i];
            const description = allPackages[i + 1];
            const [nameAndSource, version, architecture] = mainLine.split(' ');
            const name = nameAndSource.replace(/\/.*$/, '');
            const id = this.generateId({
              server,
              package: name,
              version,
              architecture,
            });
            const p = new Package();
            p.server = server;
            p.package = name;
            p.version = version;
            p.architecture = architecture;
            p.description = description;
            p.installed = false;
            p.upgradable = false;
            packagesObj[id] = p;
          }
          for (const packageLine of installedPackages) {
            const [nameAndSource, version, architecture] = packageLine.split(' ');
            const name = nameAndSource.replace(/\/.*$/, '');
            const id = this.generateId({
              server,
              package: name,
              version,
              architecture,
            });
            packagesObj[id].installed = true;
          }
          for (const packageLine of upgradablePackages) {
            const [nameAndSource, version, architecture] = packageLine.split(' ');
            const name = nameAndSource.replace(/\/.*$/, '');
            const id = this.generateId({
              server,
              package: name,
              version,
              architecture,
            });
            packagesObj[id].upgradable = true;
          }
          out.push(...Object.values(packagesObj));
        }),
      );
      return out;
    },
    update: async (_es: Package[], _ctx: Context) => {
      // TODO
      return undefined;
    },
    delete: async (es: Package[], ctx: Context) => {
      // Similarly, users cannot delete packages, only uninstall packages, so restore these
      const out = await this.module.package.db.create(es, ctx);
      if (Array.isArray(out) || !out) return out;
      return [out];
    },
  });

  constructor(module: SshAptModule) {
    super();
    this.module = module;
    super.init();
  }
}
