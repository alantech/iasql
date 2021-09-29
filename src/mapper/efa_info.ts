import { EfaInfo as EfaInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { EFAInfo } from '../entity/efa_info';

export const EFAInfoMapper = new EntityMapper(EFAInfo, {
  maximumEFAInterfaces: async (efaInfo: EfaInfoAWS, _indexes: IndexedAWS) => efaInfo?.MaximumEfaInterfaces,
})
