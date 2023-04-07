const awsResolveSupportTable = new Map<any, string[]>();

export function awsResolveSupport(Class: any, name: string, descriptor?: any) {
  if (!awsResolveSupportTable.has(Class.constructor)) awsResolveSupportTable.set(Class.constructor, []);
  awsResolveSupportTable.get(Class.constructor)?.push(name);
  return descriptor;
}

export const getAwsResolveSupport = (Entity: any) => {
  return awsResolveSupportTable.has(Entity) ? awsResolveSupportTable.get(Entity) : [];
};
