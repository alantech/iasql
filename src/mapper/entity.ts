import indexedAWS from '../services/indexed-aws'

export class EntityMapper {
  private entity: any;
  private methods: any;

  constructor(entity: any, methods: any) {
    this.entity = entity;
    this.methods = methods;
  }

  async fromAWS(obj: any): Promise<any> {
    const newEntity = new this.entity();
    Object.getOwnPropertyNames(this.methods)
      .map(p => newEntity[p] = this.methods[p](obj, indexedAWS));
    return newEntity;
  }

}
