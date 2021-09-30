const awsPrimaryKeyTable: { [key: string]: string, } = {};

export function awsPrimaryKey(Class: any, name: string, descriptor?: any) {
  awsPrimaryKeyTable[Class.constructor.name] = name;
  return descriptor;
}

export function getAwsPrimaryKey(Class: any) {
  return awsPrimaryKeyTable[Class?.name ?? ''] ?? new Error(`${Class.name} was not decorated`);
}
