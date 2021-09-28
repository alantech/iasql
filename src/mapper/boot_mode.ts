import { BootModeValues } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { BootMode, } from '../entity/boot_mode';

export const BootModeMapper = new EntityMapper(BootMode, {
  mode: async (bootMode: BootModeValues, _indexes: IndexedAWS) => bootMode,
})
