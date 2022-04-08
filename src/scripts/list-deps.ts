import { getModJsons, ModJson, } from './module-json-utils'

const moduleName = process.argv[process.argv.length - 1];

const modJsons = getModJsons();

const depModules: { [key: string]: ModJson, } = {};

const getModule = (name: string) => (Object.values(modJsons) as ModJson[])
  .find(m => name === `${m.name}@${m.version}`);

const processDep = (dep: string) => {
  const depMod = getModule(dep);
  if (!depMod) {
    throw new Error(`Could not find dependency ${dep}`);
  }
  depModules[dep] = depMod;
  depMod.dependencies.forEach(processDep);
};

processDep(moduleName);

// TODO: Remove this hackery once typeorm migration doesn't do weird alter table crap
if (moduleName !== 'iasql_platform@0.0.1') {
  delete depModules['iasql_platform@0.0.1'];
}

console.log(Object.keys(depModules).join(':'));
