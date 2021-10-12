import { EbsBlockDevice } from '@aws-sdk/client-ec2';

import { AWS, } from '../services/gateways/aws'
import { EBSBlockDeviceType, } from '../entity/ebs_block_device_type'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const EBSBlockDeviceTypeMapper = new EntityMapper(EBSBlockDeviceType, {
  deleteOnTermination: (ebd: EbsBlockDevice) => ebd?.DeleteOnTermination ?? null,
  iops: (ebd: EbsBlockDevice) => ebd?.Iops ?? null,
  snapshotId: (ebd: EbsBlockDevice) => ebd?.SnapshotId ?? null,
  volumeSize: (ebd: EbsBlockDevice) => ebd?.VolumeSize ?? null,
  volumeType: (ebd: EbsBlockDevice) => ebd?.VolumeType ?? null,
  kmsKeyId: (ebd: EbsBlockDevice) => ebd?.KmsKeyId ?? null,
  throughput: (ebd: EbsBlockDevice) => ebd?.Throughput ?? null,
  outpostArn: (ebd: EbsBlockDevice) => ebd?.OutpostArn ?? null,
  encrypted: (ebd: EbsBlockDevice) => ebd?.Encrypted ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    // Handled by AMI (I think?)
    return
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
