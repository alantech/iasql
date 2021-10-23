import * as express from 'express'
import { SnakeNamingStrategy, } from 'typeorm-naming-strategies'

import * as Modules from '../modules'
import config from '../config'
import { AWS, } from '../services/gateways/aws'
import { IasqlModule, } from '../entity'
import { TypeormWrapper, } from '../services/typeorm'

export const mod = express.Router();
mod.use(express.json());

// Mimicking `apt` in this due to the similarities in environment modules/packages are being managed
// within. Here's the list of commands `apt` itself claims are commonly used. Which should we
// support, and is there anything not present that we need to due to particulars of IaSQL? Maybe an
// "enable/disable" endpoint to stop actions for a given module (and anything dependent on it) but
// not removing it from the DB?
//
// Most used commands:
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
  if (req.body.all) {
    res.json(Object.values(Modules)
    .filter(m => m.hasOwnProperty('mappers') && m.hasOwnProperty('name'))
    .map(m => m.name));
  } else if (req.body.installed && req.body.dbname) {
    const orm = await TypeormWrapper.createConn(req.body.dbname, {
      name: req.body.dbname,
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
  // TODO: Add security to all of these endpoints
  if (!req.body.dbname) return res.json("Missing 'dbname' to install into");
  if (Array.isArray(req.body.list)) {
    const modules = req.body.list.map((n: string) => Object.values(Modules).find(m => m.name === n));
    if (modules.some((m: any) => m === undefined)) {
      return res.json(`ERROR. The following modules do not exist: ${
        req.body.list.filter((n: string) => !Object.values(Modules).find(m => m.name === n)).join(' , ')
      }`);
    }
    const entities = modules.map((m: any) => m.mappers.map((ma: any) => ma.entity)).flat();
    entities.push(IasqlModule);
    const orm = await TypeormWrapper.createConn(req.body.dbname, {
      name: req.body.dbname,
      type: 'postgres',
      username: 'postgres', // TODO: Should we use the user's account for this?
      password: 'test',
      host: 'postgresql',
      entities,
      namingStrategy: new SnakeNamingStrategy(), // TODO: Do we allow modules to change this?
    });
    const queryRunner = orm.createQueryRunner();
    await queryRunner.connect();
    // TODO: Actual dependency management and DB scanning for tables/functions/etc to be created
    for (let mod of modules) {
      if (mod.migrations?.preinstall) {
        await mod.migrations.preinstall(queryRunner);
      }
      if (mod.migrations?.postinstall) {
        await mod.migrations.postinstall(queryRunner);
      }
      const e = new IasqlModule();
      e.name = mod.name;
      e.installed = true;
      e.enabled = true;
      await orm.save(IasqlModule, e);
    }
    await queryRunner.release();
    res.json("Done!");
  } else {
    res.json("ERROR: No packages provided in 'list' property");
  }
});

// Needed at the beginning
mod.post('/remove', (req, res) => {
  if (Array.isArray(req.body.list)) {
    // TODO
    res.end(JSON.stringify("TODO", undefined, '  '));
  } else {
    res.end(JSON.stringify("ERROR", undefined, '  '));
  }
});

// Needed before first beta
mod.post('/upgrade', (_req, res) => res.end('ok'));