import * as Modules from '../modules'
import { Module, } from '../modules/interfaces'
import { sortModules, } from '../services/mod-sort'
import { TypeormWrapper, } from '../services/typeorm'

const moduleName = process.argv[process.argv.length - 1];

const depModules: { [key: string]: Module, } = {};

const getModule = (name: string) => (Object.values(Modules) as Module[])
  .find((m: Module) => name === `${m.name}@${m.version}`);

const rootModule = getModule(moduleName);

if (!rootModule) {
  throw new Error(`Could not find module ${moduleName}`); 
}

const processDep = (dep: string) => {
  const depMod = getModule(dep);
  if (!depMod) {
    throw new Error(`Could not find dependency ${dep}`);
  }
  depModules[dep] = depMod;
  depMod.dependencies.forEach(processDep);
};

rootModule.dependencies.forEach(processDep);

let sortedDeps = sortModules(Object.values(depModules), []);

// TODO: Remove this hackery once typeorm migration doesn't do weird alter table crap
if (moduleName !== 'iasql_platform@0.0.1') {
  sortedDeps = sortedDeps.filter(d => d.name !== 'iasql_platform');
}

const entities = sortedDeps.map(d => d.provides.entities).flat();

(async () => {
  const conn = await TypeormWrapper.createConn('__example__', {
    entities,
    host: 'localhost',
    username: 'postgres',
    password: 'test',
  });

  const qr = conn.createQueryRunner();

  for (const dep of sortedDeps) {
    console.log(`Adding ${dep.name}...`);
    await dep.migrations.install(qr);
  }
  console.log('Done!');
  process.exit(0);
})();