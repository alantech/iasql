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

  async toEntityList(mapper: EntityMapper, awsClient: AWS) {
    const entity = mapper.getEntity();
    const entitiesAws = Object.values(this.get(entity) ?? {});
    return await Promise.all(entitiesAws.map(e => mapper.fromAWS(e, awsClient, this)));
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

  async getOr(entity: Function, key: string, fallback: (key: string) => Promise<any>): Promise<any> {
    const entityName = entity.name;
    this.index[entityName] = this.index[entityName] ?? {};
    this.index[entityName][key] = this.index[entityName][key] ?? await fallback(key);
    return this.index[entityName][key];
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
