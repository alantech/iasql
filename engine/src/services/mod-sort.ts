import { ModuleInterface, } from '../modules/interfaces'

export const sortModules = (modules: ModuleInterface[], existingModules: string[]) => {
  const moduleList = [...modules];
  const sortedModuleNames: { [key: string]: boolean } = {};
  const sortedModules = [];
  // Put all of the existing modules into the sortedModuleNames hash so they can be used for the
  // checks
  existingModules.forEach((m: string) => sortedModuleNames[m] = true);
  do {
    const m = moduleList.shift();
    if (!m) break;
    if (
      (m.dependencies.length ?? 0) === 0 ||
      m.dependencies.every(dep => sortedModuleNames[dep])
    ) {
      sortedModuleNames[m.name] = true;
      sortedModules.push(m);
    } else {
      moduleList.push(m);
    }
  } while (moduleList.length > 0);
  return sortedModules;
}

