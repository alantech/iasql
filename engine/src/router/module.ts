import * as express from 'express'
import { SnakeNamingStrategy, } from 'typeorm-naming-strategies'

import * as Modules from '../modules'
import { IasqlModule, } from '../entity'
import { TypeormWrapper, } from '../services/typeorm'
import { getId } from '../services/db-manager'
import { lazyLoader, } from '../services/lazy-dep'

export const mod = express.Router();

// Mimicking `apt` in this due to the similarities in environment modules/packages are being managed
// within. Here's the list of commands `apt` itself claims are commonly used. Which should we
// support, and is there anything not present that we need to due to particulars of IaSQL? Maybe an
// "enable/disable" endpoint to stop actions for a given module (and anything dependent on it) but
// not removing it from the DB?
//
// Most used `apt` commands:
//  list - list packages based on package names
//  search - search in package descriptions
//  show - show package details
//  install - install packages
//  reinstall - reinstall packages
//  remove - remove packages
//  autoremove - Remove automatically all unused packages
//  update - update list of available packages
//  upgrade - upgrade the system by installing/upgrading packages
//  full-upgrade - upgrade the system by removing/installing/upgrading packages
//  edit-sources - edit the source information file
//  satisfy - satisfy dependency strings

// Needed at the beginning
mod.post('/list', async (req, res) => {
  const { all, installed, dbAlias } = req.body;
  if (all) {
    res.json(Object.values(Modules)
    .filter(m => m.hasOwnProperty('mappers') && m.hasOwnProperty('name'))
    .map(m => m.name));
  } else if (installed && dbAlias) {
    const dbId = await getId(dbAlias, req.user);
    const orm = await TypeormWrapper.createConn(dbId, {
      name: dbId,
      type: 'postgres',
      username: 'postgres', // TODO: Should we use the user's account for this?
      password: 'test',
      host: 'postgresql',
      entities: [IasqlModule],
      namingStrategy: new SnakeNamingStrategy(), // TODO: Do we allow modules to change this?
    });
    const modules = await orm.find(IasqlModule);
    res.json(modules.map((m: IasqlModule) => m.name));
  } else {
    res.end(JSON.stringify("ERROR", undefined, '  '));
  }
});

// Needed when we have more than a handful of packages
mod.post('/search', (_req, res) => res.end('ok'));

// Needed when we have metadata attached to the packages to even show
mod.post('/show', (_req, res) => res.end('ok'));

// Needed at the beginning
mod.post('/install', async (req, res) => {
  const { list, dbAlias } = req.body;
  // Don't do anything if we don't know what database to impact
  if (!dbAlias) return res.json("Missing 'dbAlias' to install into");
  const dbId = await getId(dbAlias, req.user);
  // Also don't do anything if we don't have any list of modules to install
  if (!Array.isArray(list)) return res.json("ERROR: No packages provided in 'list' property");
  // Check to make sure that all specified modules actually exist
  const modules = list.map((n: string) => Object.values(Modules).find(m => m.name === n)) as Modules.ModuleInterface[];
  if (modules.some((m: any) => m === undefined)) {
    return res.json(`ERROR. The following modules do not exist: ${
      list.filter((n: string) => !Object.values(Modules).find(m => m.name === n)).join(' , ')
    }`);
  }
  // Grab all of the entities plus the IaSQL Module entity itself and create the TypeORM connection
  // with it. Theoretically only need the module in question at first, but when we try to use the
  // module to acquire the cloud records, it may use one or more other modules it depends on, so
  // we just load them all into the TypeORM client.
  const entities = Object.values(Modules)
    .filter(m => m.hasOwnProperty('provides'))
    .map((m: any) => Object.values(m.provides.entities))
    .flat()
    .filter(e => typeof e === 'function') as Function[];
  entities.push(IasqlModule);
  const orm = await TypeormWrapper.createConn(dbId, {
    name: dbId,
    type: 'postgres',
    username: 'postgres',
    password: 'test',
    host: 'postgresql',
    entities,
    namingStrategy: new SnakeNamingStrategy(),
  });
  const queryRunner = orm.createQueryRunner();
  await queryRunner.connect();
  // See what modules are already installed and prune them from the list
  const existingModules = (await orm.find(IasqlModule)).map((m: IasqlModule) => m.name);
  for (let i = 0; i < modules.length; i++) {
    if (existingModules.includes(modules[i].name)) {
      modules.splice(i, 1);
      i--;
    }
  }
  // See if we need to abort because now there's nothing to do
  if (modules.length === 0) {
    return res.json("All modules already installed. Aborting");
  }
  // Scan the database and see if there are any collisions
  const tables = (await queryRunner.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
  `)).map((t: any) => t.table_name);
  const tableCollisions: { [key: string]: string[], } = {};
  let hasCollision = false;
  for (const md of modules) {
    tableCollisions[md.name] = [];
    if (md.provides?.tables) {
      for (const t of md.provides.tables) {
        if (tables.includes(t)) {
          tableCollisions[md.name].push(t);
          hasCollision = true;
        }
      }
    }
  }
  if (hasCollision) {
    return res.json(`Collision with existing tables detected.
${Object.keys(tableCollisions)
.filter(m => tableCollisions[m].length > 0)
.map(m => `Module ${m} collides with tables: ${tableCollisions[m].join(', ')}`)
.join('\n')
}`);
  }
  // Sort the modules based on their dependencies, with both root-to-leaf order and vice-versa
  const rootToLeafOrder = [...modules].sort((a, b) => {
    // Assuming no dependency loops
    if (a.dependencies.includes(b.name)) return 1;
    if (b.dependencies.includes(a.name)) return -1;
    return 0;
  });
  const leafToRootOrder = [...rootToLeafOrder].reverse();
  // Actually run the installation. First running all of the preinstall scripts from leaf-to-root,
  // then all of the postinstall scripts from root-to-leaf. Wrapped in a transaction so any failure
  // at this point when we're actually mutating the database doesn't leave things in a busted state.
  await queryRunner.startTransaction();
  try {
    for (const md of leafToRootOrder) {
      if (md.migrations?.preinstall) {
        await md.migrations.preinstall(queryRunner);
      }
    }
    for (const md of rootToLeafOrder) {
      if (md.migrations?.preinstall) {
        await md.migrations.preinstall(queryRunner);
      }
      if (md.migrations?.postinstall) {
        await md.migrations.postinstall(queryRunner);
      }
      const e = new IasqlModule();
      e.name = md.name;
      e.dependencies = await Promise.all(
        md.dependencies.map(async (dep) => await orm.findOne(IasqlModule, { name: dep, }))
      );
      await orm.save(IasqlModule, e);
    }
    await queryRunner.commitTransaction();
  } catch (e) {
    await queryRunner.rollbackTransaction();
    return res.json(`Error: ${(e as any).message}`);
  } finally {
    await queryRunner.release();
  }
  // For all newly installed modules, query the cloud state, if any, and save it to the database.
  // Since the context requires all installed modules and that has changed, for simplicity's sake
  // we're re-loading the modules and constructing the context that way, first, but then iterating
  // through the mappers of only the newly installed modules to sync from cloud to DB.
  // TODO: For now we're gonna use the TypeORM client directly, but we should be using `db.create`,
  // but we aren't right now because it would be slower. Need to figure out if/how to change the
  // mapper to make batch create/update/delete more efficient.

  // Find all of the installed modules, and create the context object only for these
  const moduleNames = (await orm.find(IasqlModule)).map((m: IasqlModule) => m.name);
  const context: Modules.Context = { orm, memo: {}, }; // Every module gets access to the DB
  for (const name of moduleNames) {
    const md = Object.values(Modules).find(m => m.name === name) as Modules.ModuleInterface;
    if (!md) throw new Error(`This should be impossible. Cannot find module ${name}`);
    const moduleContext = md.provides.context ?? {};
    Object.keys(moduleContext).forEach(k => context[k] = moduleContext[k]);
  }
  // Get the relevant mappers, which are the ones where the DB is the source-of-truth
  const mappers = modules
    .map(md => Object.values(md.mappers))
    .flat()
  await lazyLoader(mappers.map(mapper => async () => {
    const e = await mapper.cloud.read(context);
    if (!e || (Array.isArray(e) && !e.length)) {
      console.log('Completely unexpected outcome');
      console.log({ mapper, e, });
    } else {
      await Promise.all(e.map(async (entity: any) => {
        await mapper.db.create(entity, context);
      }));
    }
  }));
  res.json("Done!");
});

// Needed at the beginning
mod.post('/remove', async (req, res) => {
  const { list, dbAlias } = req.body;
  // Don't do anything if we don't know what database to impact
  if (!dbAlias) return res.json("Missing 'dbAlias' to install into");
  const dbId = await getId(dbAlias, req.user);
  // Also don't do anything if we don't have any list of modules to install
  if (!Array.isArray(list)) return res.json("ERROR: No packages provided in 'list' property");
  // Check to make sure that all specified modules actually exist
  const modules = list.map((n: string) => Object.values(Modules).find(m => m.name === n)) as Modules.ModuleInterface[];
  if (modules.some((m: any) => m === undefined)) {
    return res.json(`ERROR. The following modules do not exist: ${
      list.filter((n: string) => !Object.values(Modules).find(m => m.name === n)).join(' , ')
    }`);
  }
  // Grab all of the entities from the module plus the IaSQL Module entity itself and create the
  // TypeORM connection with it.
  const entities = modules.map((m: any) => Object.values(m.mappers).map((ma: any) => ma.entity)).flat();
  entities.push(IasqlModule);
  const orm = await TypeormWrapper.createConn(dbId, {
    name: dbId,
    type: 'postgres',
    username: 'postgres',
    password: 'test',
    host: 'postgresql',
    entities,
    namingStrategy: new SnakeNamingStrategy(),
  });
  const queryRunner = orm.createQueryRunner();
  await queryRunner.connect();
  // See what modules are already removed and prune them from the list
  const existingModules = (await orm.find(IasqlModule)).map((m: IasqlModule) => m.name);
  for (let i = 0; i < modules.length; i++) {
    if (!existingModules.includes(modules[i].name)) {
      modules.splice(i, 1);
      i--;
    }
  }
  // See if we need to abort because now there's nothing to do
  if (modules.length === 0) {
    return res.json("All modules already removed. Aborting");
  }
  // Sort the modules based on their dependencies, with both root-to-leaf order and vice-versa
  const rootToLeafOrder = [...modules].sort((a, b) => {
    // Assuming no dependency loops
    if (a.dependencies.includes(b.name)) return 1;
    if (b.dependencies.includes(a.name)) return -1;
    return 0;
  });
  const leafToRootOrder = [...rootToLeafOrder].reverse();
  // Actually run the removal. First running all of the preremove scripts from leaf-to-root, then
  // all of the postremove scripts from root-to-leaf. Wrapped in a transaction so any failure at
  // this point when we're actually mutating the database doesn't leave things in a busted state.
  await queryRunner.startTransaction();
  try {
    for (const md of leafToRootOrder) {
      if (md.migrations?.preinstall) {
        await md.migrations.preinstall(queryRunner);
      }
    }
    for (const md of rootToLeafOrder) {
      if (md.migrations?.preremove) {
        await md.migrations.preremove(queryRunner);
      }
      if (md.migrations?.postremove) {
        await md.migrations.postremove(queryRunner);
      }
      const e = await orm.findOne(IasqlModule, { name: md.name, });
      await orm.remove(IasqlModule, e);
    }
    await queryRunner.commitTransaction();
  } catch (e) {
    await queryRunner.rollbackTransaction();
    return res.json(`Error: ${(e as any).message}`);
  } finally {
    await queryRunner.release();
  }
  res.json("Done!");
});

// Needed before first beta
mod.post('/upgrade', (_req, res) => res.end('ok'));