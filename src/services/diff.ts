export function findDiff(
  dbEntities: any[],
  cloudEntities: any[],
  idGen: (e: any) => string,
  comparator: (a: any, b: any) => boolean
) {
  const entitiesInDbOnly: any[] = [];
  const entitiesInAwsOnly: any[] = [];
  const dbEntityIds = dbEntities.map(idGen);
  const cloudEntityIds = cloudEntities.map(idGen);
  // Everything in cloud and not in db is a potential delete
  const cloudEntNotInDb = cloudEntities.filter(e => !dbEntityIds.includes(idGen(e)));
  cloudEntNotInDb.map(e => entitiesInAwsOnly.push(e));
  // Everything in db and not in cloud is a potential create
  const dbEntNotInCloud = dbEntities.filter(e => !cloudEntityIds.includes(idGen(e)));
  dbEntNotInCloud.map(e => entitiesInDbOnly.push(e));
  // Everything else needs a diff between them
  const remainingDbEntities = dbEntities.filter(e => cloudEntityIds.includes(idGen(e)));
  const entitiesChanged: any[] = [];
  remainingDbEntities.map(dbEnt => {
    const cloudEntToCompare = cloudEntities.find(e => idGen(e) === idGen(dbEnt));
    if (!comparator(dbEnt, cloudEntToCompare)) {
      entitiesChanged.push({
        db: dbEnt,
        cloud: cloudEntToCompare,
      });
    }
  });
  return {
    entitiesInDbOnly,
    entitiesInAwsOnly,
    entitiesChanged,
  };
}
