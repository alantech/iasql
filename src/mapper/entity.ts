import { memoize } from 'memoize-cache-decorator'

import indexedAWS from '../services/indexed-aws'

export class EntityMapper {
  private entity: any;
  private methods: any;

  constructor(entity: any, methods: any) {
    this.entity = entity;
    this.methods = methods;
  }

  @memoize()
  async fromAWS(obj: any): Promise<any> {
    const newEntity = new this.entity();
    for(const p of Object.getOwnPropertyNames(this.methods)) {
      newEntity[p] = await this.methods[p](obj, indexedAWS);
    }
    return newEntity;
  }

}
