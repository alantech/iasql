import { EbsBlockDevice } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { EBSBlockDeviceType, } from '../entity/ebs_block_device_type';

export const EBSBlockDeviceTypeMapper = new EntityMapper(EBSBlockDeviceType, {
  deleteOnTermination: async (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.DeleteOnTermination,
  iops: async (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.Iops,
  snapshotId: async (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.SnapshotId,
  volumeSize: async (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.VolumeSize,
  volumeType: async (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.VolumeType,
  kmsKeyId: async (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.KmsKeyId,
  throughput: async (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.Throughput,
  outpostArn: async (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.OutpostArn,
  encrypted: async (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.Encrypted,
})
