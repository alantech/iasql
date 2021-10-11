import { Image } from '@aws-sdk/client-ec2';

import { AWS, } from './gateways/aws'
import { EntityMapper, } from '../mapper'


type Index = {
  [entity: string]: {
    [key: string]: any,
  },
};

export class IndexedAWS {
  private index: Index;

  constructor() {
    this.index = {};
  }

  toEntityList(mapper: EntityMapper) {
    const entity = mapper.getEntity();
    const entitiesAws = Object.values(this.get(entity) ?? {});
    return entitiesAws.map(e => mapper.fromAWS(e, this));
  }

  set(entity: Function, key: string, value: any) {
    const entityName = entity.name;
    this.index[entityName] = this.index[entityName] ?? {};
    this.index[entityName][key] = value;
  }

  setAll(entity: Function, entityList: any[], idName: string) {
    const entityName = entity.name;
    this.index[entityName] = this.index[entityName] ?? {};
    entityList.forEach(e => this.index[entityName][e[idName] ?? ''] = e);
  }

  setAllWithComposeKey(entity: Function, entityList: any[], idNames: string[]) {
    const entityName = entity.name;
    this.index[entityName] = this.index[entityName] ?? {};
    entityList.forEach(e => {
      const idName = idNames.map(n => e[n]).join('');
      this.index[entityName][idName ?? ''] = e;
    });
  }

  get(entity?: Function, key?: string) {
    if (!entity && key) {
      throw new Error('Error getting indexed entities');
    }
    if (entity && key) {
      const entityName = entity.name;
      if (!(entityName in this.index)) return undefined;
      return this.index[entityName][key];
    }
    if (entity) {
      return this.index[entity.name];
    }
    return this.index;
  }

  del(entity: Function, key: string) {
    const entityName = entity.name;
    this.index[entityName] = this.index[entityName] ?? {};
    delete this.index[entityName][key];
  }

  flush() {
    this.index = {};
  }
}
