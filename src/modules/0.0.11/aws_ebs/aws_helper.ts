import { EC2, paginateDescribeVolumes, Tag, Volume } from '@aws-sdk/client-ec2';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder, } from '../../../services/aws_macros'

export const createVolume = crudBuilderFormat<EC2, 'createVolume', string | undefined>(
  'createVolume',
  (input) => (input),
  (res) => res?.VolumeId,
);

export const getGeneralPurposeVolumes = paginateBuilder<EC2>(
  paginateDescribeVolumes,
  'Volumes',
  undefined,
  undefined,
  () => ({
    Filters: [{
      Name: 'volume-type',
      Values: ['gp2', 'gp3'],
    },
    {
      Name: 'status',
      Values: ['available', 'in-use', 'error'],
    }]
  })
);

export const getVolume = crudBuilderFormat<EC2, 'describeVolumes', Volume | undefined>(
  'describeVolumes',
  (VolumeId) => ({ VolumeIds: [VolumeId] }),
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

export const attachVolume = crudBuilder2<EC2, 'attachVolume'>(
  'attachVolume',
  (VolumeId, InstanceId, Device) => ({ VolumeId, InstanceId, Device, })
);

export const detachVolume = crudBuilder2<EC2, 'detachVolume'>(
  'detachVolume',
  (VolumeId) => ({ VolumeId, })
);

// TODO: Figure out if/how to macro-ify this thing
export const updateTags = async (client: EC2, resourceId: string, tags?: { [key: string] : string }) => {
  let tgs: Tag[] = [];
  if (tags) {
    tgs = Object.keys(tags).map(k => {
      return {
        Key: k, Value: tags[k]
      }
    });
  }
  // recreate tags
  await client.deleteTags({
    Resources: [resourceId],
  });
  await client.createTags({
    Resources: [resourceId],
    Tags: tgs,
  })
}

export { AWS }