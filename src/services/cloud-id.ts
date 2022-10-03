const cloudIdTable = new Map<any, string[]>();

export function cloudId(Class: any, name: string, descriptor?: any) {
  if (!cloudIdTable.has(Class.constructor)) cloudIdTable.set(Class.constructor, []);
  cloudIdTable.get(Class.constructor)?.push(name);
  return descriptor;
}

export const getCloudId = (Entity: any) => {
  if (!cloudIdTable.has(Entity)) {
    return new Error(`No @cloudId decorator usage on ${Entity?.name}`);
  }
  return cloudIdTable.get(Entity);
};
