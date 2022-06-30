import { EC2, paginateDescribeVolumes, Volume } from '@aws-sdk/client-ec2';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder, } from '../../../services/aws_macros'

export const createVolume = crudBuilderFormat<EC2, 'createVolume', string | undefined>(
  'createVolume',
  (input) => (input),
  (res) => res?.VolumeId,
);

export const getVolumes = paginateBuilder<EC2>(
  paginateDescribeVolumes,
  'Volumes',
);

export const getVolume = crudBuilderFormat<EC2, 'describeVolumes', Volume | undefined>(
  'describeVolumes',
  (VolumeIds) => ({ VolumeIds }),
  (res) => res?.Volumes?.pop()
);

export const deleteVolume = crudBuilder2<EC2, 'deleteVolume'>(
  'deleteVolume',
  (VolumeId) => ({ VolumeId, }),
);

export const updateVolume = crudBuilder2<EC2, 'modifyVolume'>(
  'modifyVolume',
  (input) => (input)
);

export { AWS }