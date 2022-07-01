import { DescribeVolumesCommandInput, EC2, paginateDescribeVolumes, Tag, Volume } from '@aws-sdk/client-ec2';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder, } from '../../../services/aws_macros'
import { VolumeState } from './entity';

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

const attachVolumeInternal = crudBuilder2<EC2, 'attachVolume'>(
  'attachVolume',
  (VolumeId, InstanceId, Device) => ({ VolumeId, InstanceId, Device, })
);

// TODO: Figure out if/how to macro-ify this thing
export const attachVolume = async (client: EC2, VolumeId: string, InstanceId: string, Device: string) => {
  await attachVolumeInternal(client, VolumeId, InstanceId, Device);
  const describeInput: DescribeVolumesCommandInput = {
    VolumeIds: [VolumeId],
  };
  await createWaiter<EC2, DescribeVolumesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    describeInput,
    async (cl, input) => {
      const data = await cl.describeVolumes(input);
      try {
        const vol = data.Volumes?.pop();
        // If state is not 'in-use' retry
        if (!Object.is(vol?.State, VolumeState.IN_USE)) {
          return { state: WaiterState.RETRY };
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        throw e;
      }
    },
  );
}

const detachVolumeInternal = crudBuilder2<EC2, 'detachVolume'>(
  'detachVolume',
  (VolumeId) => ({ VolumeId, })
);

// TODO: Figure out if/how to macro-ify this thing
export const detachVolume = async (client: EC2, VolumeId: string) => {
  await detachVolumeInternal(client, VolumeId);
  const describeInput: DescribeVolumesCommandInput = {
    VolumeIds: [VolumeId],
  };
  await createWaiter<EC2, DescribeVolumesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    describeInput,
    async (cl, input) => {
      const data = await cl.describeVolumes(input);
      try {
        const vol = data.Volumes?.pop();
        // If state is not 'available' retry
        if (!Object.is(vol?.State, VolumeState.AVAILABLE)) {
          return { state: WaiterState.RETRY };
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        throw e;
      }
    },
  );
}

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