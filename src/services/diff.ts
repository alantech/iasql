function mapSegmentation<X, Y>(a: Map<X, Y>, b: Map<X, Y>): [Map<X, Y>, Map<X, [Y, Y]>, Map<X, Y>] {
  const left: Map<X, Y> = new Map();
  const intersect: Map<X, [Y, Y]> = new Map();
  const right: Map<X, Y> = new Map();
  // I feel like this can be done with a single pass, but I'm not sure exactly how, yet. At least it's
  // not three passes
  for (const aVal of a) {
    if (b.has(aVal[0])) intersect.set(aVal[0], [aVal[1], b.get(aVal[0])!]);
    else left.set(...aVal);
  }
  for (const bVal of b) {
    if (!a.has(bVal[0])) right.set(...bVal);
  }
  return [left, intersect, right];
}

export function findDiff(
  dbEntities: any[],
  cloudEntities: any[],
  idGen: (e: any) => string,
  comparator: (a: any, b: any) => boolean,
) {
  const dbEntitiesById = new Map(dbEntities.map(e => [idGen(e), e]));
  const cloudEntitiesById = new Map(cloudEntities.map(e => [idGen(e), e]));
  const [dbOnlyEntitiesById, remainingEntitiesById, cloudOnlyEntitiesById] = mapSegmentation(
    dbEntitiesById,
    cloudEntitiesById,
  );
  const entitiesChanged: any[] = [];
  for (const remainingEntitiesRecord of remainingEntitiesById.values()) {
    const [dbEnt, cloudEnt] = remainingEntitiesRecord;
    if (!comparator(dbEnt, cloudEnt)) {
      entitiesChanged.push({
        db: dbEnt,
        cloud: cloudEnt,
      });
    }
  }
  const entitiesInDbOnly = [...dbOnlyEntitiesById.values()];
  const entitiesInAwsOnly = [...cloudOnlyEntitiesById.values()];
  return {
    entitiesInDbOnly,
    entitiesInAwsOnly,
    entitiesChanged,
  };
}
