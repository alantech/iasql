const cloudIdTable: { [key: string]: string, } = {};

export function cloudId(Class: any, name: string, descriptor?: any) {
  cloudIdTable[Class.constructor.name] = name;
  return descriptor;
}

export function getCloudId(Class: any) {
  return cloudIdTable[Class?.name ?? ''] ?? new Error(`${Class.name} was not decorated`);
}