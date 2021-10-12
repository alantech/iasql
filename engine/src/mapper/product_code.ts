import { ProductCode as ProductCodeAWS } from '@aws-sdk/client-ec2';

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { ProductCode, } from '../entity/product_code'

export const ProductCodeMapper = new EntityMapper(ProductCode, {
  productCodeId: (productCode: ProductCodeAWS) => productCode?.ProductCodeId ?? null,
  productCodeType: (productCode: ProductCodeAWS) => productCode?.ProductCodeType ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    // Handled by AMI
    return
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
