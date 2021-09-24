import { RegionMapper } from "./region";

export class EntityMapper extends RegionMapper {

  // TODO avoid using name property?
  static prototypeFilter = ['length', /*'name',*/ 'prototype',]

  static async fromAWS(obj: any, entity: any, mapper: any): Promise<any> {
    const newEntity = new entity();
    Object.getOwnPropertyNames(mapper)
      .filter(p => !EntityMapper.prototypeFilter.includes(p))
      .map(p => newEntity[p] = mapper[p](obj));
    return newEntity;
  }

}
