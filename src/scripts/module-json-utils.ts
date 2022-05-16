/* tslint:disable no-console */
import fs from 'fs'

export type ModJson = {
  name: string,
  version: string,
  dependencies: string[],
}

export const getModJsons = (version: string) => {
  const modDir = fs.readdirSync(`${__dirname}/../modules/${version}`).filter(r => !/.ts$/.test(r));
  const modJsons: ModJson[] = modDir
    .map(r => fs.readFileSync(`${__dirname}/../modules/${version}/${r}/module.json`, 'utf8'))
    .map(r => JSON.parse(r) as ModJson);
  const mods: { [key: string]: ModJson, } = {};
  modJsons.forEach(m => mods[m.name] = m);
  return mods;
}

// TODO: Figure out some way to DRY this logic with `interfaces.ts`
export const getModMigration = (name: string, version: string) => {
  const migrationDir = `${__dirname}/../modules/${version}/${name}/migration`;
  const files = fs.readdirSync(migrationDir)
    .filter(r => !/.map$/.test(r));
  if (files.length !== 1) throw new Error('Cannot determine migration file');
  const migration = require(`${migrationDir}/${files[0]}`);
  // Assuming TypeORM migration files
  const migrationClass = migration[Object.keys(migration)[0]];
  if (!migrationClass || !migrationClass.prototype.up || !migrationClass.prototype.down) {
    throw new Error('Presumed migration file is not a TypeORM migration');
  }
  return migrationClass;
}

// TODO: Figure out some way to DRY this logic with `dep-sorting.ts`
export const sortMods = (name: string, version: string, includeRoot: boolean) => {
  const mods = getModJsons(version);
  const rootMod = mods[name];
  console.log({ mods, rootMod, });
  const modSubset: { [key: string]: ModJson, } = includeRoot ? { name: rootMod, } : {};
  const processMod = (mod: ModJson) => {
    mod.dependencies.map(d => d.split('@')[0]).forEach(dep => {
      const depMod = mods[dep];
      modSubset[dep] = depMod;
      processMod(depMod);
    });
  };
  processMod(rootMod);
  const moduleList = Object.values(modSubset);
  const sortedModuleNames: { [key: string]: boolean } = {};
  const sortedModules = [];
  do {
    console.log({
      moduleList,
      sortedModuleNames,
      sortedModules,
    });
    const m = moduleList.shift();
    if (!m) break;
    if (
      (m.dependencies.length ?? 0) === 0 ||
      m.dependencies.map(d => d.split('@')[0]).every(dep => sortedModuleNames[dep])
    ) {
      if (!includeRoot && m.name === name) continue;
      sortedModuleNames[m.name] = true;
      sortedModules.push(m);
    } else {
      moduleList.push(m);
    }
  } while (moduleList.length > 0);
  return sortedModules;
}
