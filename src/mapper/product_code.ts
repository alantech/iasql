import { ProductCode as ProductCodeAWS } from '@aws-sdk/client-ec2';

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'
import { ProductCode, } from '../entity/product_code';

export const ProductCodeMapper = new EntityMapper(ProductCode, {
  productCodeId: (productCode: ProductCodeAWS, _indexes: IndexedAWS) => productCode?.ProductCodeId,
  productCodeType: (productCode: ProductCodeAWS, _indexes: IndexedAWS) => productCode?.ProductCodeType,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
