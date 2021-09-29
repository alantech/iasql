import { EbsBlockDevice } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { EBSBlockDeviceType, } from '../entity/ebs_block_device_type';

export const EBSBlockDeviceTypeMapper = new EntityMapper(EBSBlockDeviceType, {
  deleteOnTermination: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.DeleteOnTermination,
  iops: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.Iops,
  snapshotId: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.SnapshotId,
  volumeSize: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.VolumeSize,
  volumeType: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.VolumeType,
  kmsKeyId: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.KmsKeyId,
  throughput: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.Throughput,
  outpostArn: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.OutpostArn,
  encrypted: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.Encrypted,
}, {
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
