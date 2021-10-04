import { EbsBlockDevice } from '@aws-sdk/client-ec2';

import { AWS, } from '../services/gateways/aws'
import { EBSBlockDeviceType, } from '../entity/ebs_block_device_type';
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'

export const EBSBlockDeviceTypeMapper = new EntityMapper(EBSBlockDeviceType, {
  deleteOnTermination: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.DeleteOnTermination ?? null,
  iops: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.Iops ?? null,
  snapshotId: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.SnapshotId ?? null,
  volumeSize: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.VolumeSize ?? null,
  volumeType: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.VolumeType ?? null,
  kmsKeyId: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.KmsKeyId ?? null,
  throughput: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.Throughput ?? null,
  outpostArn: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.OutpostArn ?? null,
  encrypted: (ebd: EbsBlockDevice, _indexes: IndexedAWS) => ebd?.Encrypted ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    // Handled by AMI (I think?)
    return
  },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
