const sourceOfTruthTable: { [key: string]: string, } = {};

export enum Source {
  AWS = 'aws',
  DB = 'db',
}

export function source(origin: Source) {
  return function decorator(Class: any) {
    sourceOfTruthTable[Class.name] = origin;
    return Class;
  };
}

export function getSourceOfTruth(Class: any) {
  return sourceOfTruthTable[Class?.name ?? ''] ?? new Error(`${Class.name} was not decorated`);
}
