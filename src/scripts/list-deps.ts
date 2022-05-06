import { getModJsons, ModJson, } from './module-json-utils'

const moduleName = process.argv[process.argv.length - 2];
const moduleVersion = process.argv[process.argv.length - 1];

const modJsons = getModJsons(moduleVersion);

const depModules: { [key: string]: ModJson, } = {};

const getModule = (name: string) => (Object.values(modJsons) as ModJson[])
  .find(m => name === m.name);

const processDep = (dep: string) => {
  const depMod = getModule(dep);
  if (!depMod) {
    throw new Error(`Could not find dependency ${dep}`);
  }
  depModules[dep] = depMod;
  depMod.dependencies.map(d => d.split('@')[0]).forEach(processDep);
};

processDep(moduleName);

// TODO: Remove this hackery once typeorm migration doesn't do weird alter table crap
if (moduleName !== 'iasql_platform') {
  delete depModules.iasql_platform;
}

console.log(Object.keys(depModules).join(':'));
