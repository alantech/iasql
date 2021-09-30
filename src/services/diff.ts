const diffExclusionTable: { [key: string]: string[], } = {};

// Decorator function that indicates fields that should not be compared when diffing
// database and AWS sources. Usually for sub-objects controlled by a different AWS endpoint
export function noDiff(Class: any, name: string, descriptor?: any) {
  diffExclusionTable[Class.constructor.name] = diffExclusionTable[Class.constructor.name] ?? [];
  diffExclusionTable[Class.constructor.name].push(name);
  return descriptor;
}

// TODO refactor to a class
export function findDiff(entity: string, dbEntities: any[], cloudEntities: any[], id: string) {
  const exclusionList = diffExclusionTable[entity] ?? [];
  const entitiesInDbOnly: any[] = [];
  const entitiesInAwsOnly: any[] = [];
  const dbEntityIds = dbEntities.map(e => e[id]);
  const cloudEntityIds = cloudEntities.map(e => e[id]);
  // Everything in cloud and not in db is a potential delete
  const cloudEntNotInDb = cloudEntities.filter(e => !dbEntityIds.includes(e[id]));
  cloudEntNotInDb.map(e => entitiesInAwsOnly.push(e));
  // Everything in db and not in cloud is a potential create
  const dbEntNotInCloud = dbEntities.filter(e => !cloudEntityIds.includes(e[id]));
  dbEntNotInCloud.map(e => entitiesInDbOnly.push(e));
  // Everything else needs a diff between them
  const remainingDbEntities = dbEntities.filter(e => cloudEntityIds.includes(e[id]));
  const entitiesDiff: any[] = [];
  remainingDbEntities.map(dbEnt => {
    const cloudEntToCompare = cloudEntities.find(e => e[id] === dbEnt[id]);
    entitiesDiff.push(diff(dbEnt, cloudEntToCompare, exclusionList));
  });
  return {
    entitiesInDbOnly,
    entitiesInAwsOnly,
    entitiesDiff
  }
}

function diff(dbObj: any, cloudObj: any, exclusionList: string[]) {
  if (isValue(dbObj) || isValue(cloudObj)) {
    return {
      type: compare(dbObj, cloudObj),
      db: dbObj,
      cloud: cloudObj
    };
  }
  const diffObj: any = {};
  for (const key in dbObj) {
    // Ignore excluded keys
    if (exclusionList.includes(key)) {
      continue;
    }
    const cloudVal = cloudObj[key];
    diffObj[key] = diff(dbObj[key], cloudVal, exclusionList);
  }
  for (const key in cloudObj) {
    if (exclusionList.includes(key) || diffObj[key] !== undefined) {
      continue;
    }
    diffObj[key] = diff(undefined, cloudObj[key], exclusionList);
  }
  return diffObj;
}

function isValue(o: any) {
  return !isObject(o) && !isArray(o);
}

function isObject(o: any) {
  return typeof o === 'object' && o !== null && !Array.isArray(o);
}

function isArray(o: any) {
  return Array.isArray(o);
}

function isDate(o: any) {
  return o instanceof Date;
}

function compare(dbVal: any, cloudVal: any) {
  if (dbVal === cloudVal) {
    return 'unchanged'
  }
  if (isDate(dbVal) && isDate(cloudVal) && dbVal.getTime() === cloudVal.getTime()) {
    return 'unchanged'
  }
  return `to update ${cloudVal} with ${dbVal}`
}
