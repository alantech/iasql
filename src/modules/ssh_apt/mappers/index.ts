import { SshAptModule } from '..';
import { Context, Crud, MapperBase } from '../../interfaces';
import { Package } from '../entity';

export class PackageMapper extends MapperBase<Package> {
  module: SshAptModule;
  entity = Package;

  equals = (a: Package, b: Package) =>
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
            const packageId = this.generateId({
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
            packagesObj[packageId] = p;
          }
          for (const packageLine of installedPackages) {
            const [nameAndSource, version, architecture] = packageLine.split(' ');
            const name = nameAndSource.replace(/\/.*$/, '');
            const packageId = this.generateId({
              server,
              package: name,
              version,
              architecture,
            });
            packagesObj[packageId].installed = true;
          }
          for (const packageLine of upgradablePackages) {
            const [nameAndSource, version, architecture] = packageLine.split(' ');
            const name = nameAndSource.replace(/\/.*$/, '');
            const packageId = this.generateId({
              server,
              package: name,
              version,
              architecture,
            });
            packagesObj[packageId].upgradable = true;
          }
          out.push(...Object.values(packagesObj));
        }),
      );
      return out;
    },
    update: async (es: Package[], ctx: Context) => {
      // Changes to these records fall under three categories:
      // 1. A change to the description or updatable status should be restored.
      // 2. Setting the installed flag to true means it should be installed.
      // 3. Setting the installed flag to false means it should be uninstalled.
      // These operations are batched, for the following reasons:
      // 1. Restoring incorrectly modified records doesn't require talking to the server, so
      //    we don't need to keep it in the loop
      // 2. We can batch install/uninstall packages with the `apt install` / `apt remove` commands
      // 3. To follow the user's intent best, we should do uninstalls first, followed by installs,
      //    this is to make sure the set of packages marked as installed are still present in case
      //    uninstalling a package triggers an uninstall of a package marked as to be installed.
      // Finally, once this is all done, we call a cloud read and sync the packages manually into
      // the database for any side-effect installed/uninstalled flags for other packages.
      // All of this must be batched per server
      const packageGroupsByServer: {
        [key: string]: { toRestore: Package[]; toInstall: Package[]; toUninstall: Package[] };
      } = {};
      for (const e of es) {
        const packageGroup = packageGroupsByServer[e.server] || {
          toRestore: [],
          toInstall: [],
          toUninstall: [],
        };
        packageGroupsByServer[e.server] = packageGroup;
        const id = this.generateId({
          server: e.server,
          package: e.package,
          version: e.version,
          architecture: e.architecture,
        });
        const cloudE = ctx.memo.cloud.Package[id] as Package;
        if (e.description !== cloudE.description || e.upgradable !== cloudE.upgradable) {
          cloudE.id = e.id;
          packageGroup.toRestore.push(cloudE);
        } else if (e.installed) {
          // We know this is the only other column, so it must have changed
          packageGroup.toInstall.push(e);
        } else {
          packageGroup.toUninstall.push(e);
        }
      }
      const clientsAndServers = await Promise.all(
        Object.keys(packageGroupsByServer).map(async (s: string) => ({
          server: s,
          client: await ctx.getSshClient(s),
        })),
      );
      await Promise.all(
        clientsAndServers.map(async clientAndServer => {
          const { client, server } = clientAndServer;
          const packageGroup = packageGroupsByServer[server];
          if (packageGroup.toRestore.length) {
            await this.db.update(packageGroup.toRestore, ctx);
          }
          if (packageGroup.toUninstall.length) {
            const removeCommand = `yes | sudo apt remove ${packageGroup.toUninstall
              .map(e => e.package)
              .join(' ')}`;
            try {
              await client.exec(removeCommand);
            } catch (e) {
              // stderr causes a throw in this API, so it's not important; we will also explicitly
              // sync the db with the cloud state once done, anyways
            }
          }
          if (packageGroup.toInstall.length) {
            const installCommand = `yes | sudo apt install ${packageGroup.toInstall
              .map(e => `'${e.package}=${e.version}'`)
              .join(' ')}`;
            try {
              await client.exec(installCommand);
            } catch (e) {
              // stderr causes a throw in this API, so it's not important; we will also explicitly
              // sync the db with the cloud state once done, anyways
            }
          }
        }),
      );
      // Flush the cache to be sure we're re-reading from the servers
      delete ctx.memo.cloud.Package;
      await this.cloud.read(ctx);
      // For this pass, only worry about the packages that were marked to be updated and replace
      // only those in the database
      const newPackages = [];
      for (const e of es) {
        const id = this.generateId({
          server: e.server,
          package: e.package,
          version: e.version,
          architecture: e.architecture,
        });
        const newPackage = (await this.cloud.read(ctx, id)) as Package;
        newPackage.id = e.id;
        newPackages.push(newPackage);
      }
      const out = await this.db.update(newPackages, ctx);
      if (Array.isArray(out) || !out) return out;
      return [out];
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
