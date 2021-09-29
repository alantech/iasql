
import { ProductCode as ProductCodeAWS } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { ProductCode, } from '../entity/product_code';

export const ProductCodeMapper = new EntityMapper(ProductCode, {
  productCodeId: async (productCode: ProductCodeAWS, _indexes: IndexedAWS) => productCode?.ProductCodeId,
  productCodeType: async (productCode: ProductCodeAWS, _indexes: IndexedAWS) => productCode?.ProductCodeType,
}, {
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
