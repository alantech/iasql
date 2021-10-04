import { memoize } from 'memoize-cache-decorator'

import { IndexedAWS, } from '../services/indexed-aws'
import { AWS, } from '../services/gateways/aws'

type AwsInFn = (obj: any, indexes: IndexedAWS) => any;
type AwsFn = (obj: any, awsClient: AWS, indexes: IndexedAWS) => any;
type FromAws = { [key: string]: AwsInFn, };
type ToAws = {
  readAWS: (awsClient: AWS, indexes: IndexedAWS) => any,
  createAWS: AwsFn,
  deleteAWS: AwsFn,
  updateAWS: AwsFn,
};

export class EntityMapper {
  private entity: any;
  private methods: FromAws;
  private toAws: ToAws;

  constructor(entity: any, methods: FromAws, toAws: ToAws) {
    this.entity = entity;
    this.methods = methods;
    this.toAws = toAws;
  }

  getEntity() {
    return this.entity;
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

  readAWS(awsClient: AWS, indexes: IndexedAWS): Promise<any> {
    return this.toAws.readAWS(awsClient, indexes);
  }

  createAWS(obj: any, awsClient: AWS, indexes: IndexedAWS): Promise<any> {
    return this.toAws.createAWS(obj, awsClient, indexes);
  }

  deleteAWS(obj: any, awsClient: AWS, indexes: IndexedAWS): Promise<any> {
    return this.toAws.deleteAWS(obj, awsClient, indexes);
  }

  updateAWS(obj: any, awsClient: AWS, indexes: IndexedAWS): Promise<any> {
    return this.toAws.updateAWS(obj, awsClient, indexes);
  }
}
