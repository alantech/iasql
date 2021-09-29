import { memoize } from 'memoize-cache-decorator'

import { IndexedAWS, } from '../services/indexed-aws'

type AwsFn = (obj: any, indexes: IndexedAWS) => any;
type FromAws = { [key: string]: AwsFn, };
type ToAws = { createAWS: AwsFn, deleteAWS: AwsFn, updateAWS: AwsFn, };

export class EntityMapper {
  private entity: any;
  private methods: FromAws;
  private toAws: ToAws;

  constructor(entity: any, methods: FromAws, toAws: ToAws) {
    this.entity = entity;
    this.methods = methods;
    this.toAws = toAws;
  }

  @memoize({
    resolver: (obj, _indexes) => JSON.stringify(obj), // TODO: Better hashing fn
  })
  fromAWS(obj: any, indexes: IndexedAWS): any {
    const newEntity = new this.entity();
    for(const p of Object.getOwnPropertyNames(this.methods)) {
      newEntity[p] = this.methods[p](obj, indexes);
    }
    return newEntity;
  }

  createAWS(obj: any, indexes: IndexedAWS): Promise<any> {
    return this.toAws.createAWS(obj, indexes);
  }

  deleteAWS(obj: any, indexes: IndexedAWS): Promise<any> {
    return this.toAws.deleteAWS(obj, indexes);
  }

  updateAWS(obj: any, indexes: IndexedAWS): Promise<any> {
    return this.toAws.updateAWS(obj, indexes);
  }
}
