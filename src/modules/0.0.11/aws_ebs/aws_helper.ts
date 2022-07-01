import { CreateVolumeCommandInput, DescribeVolumesCommandInput, EC2, paginateDescribeVolumes, Tag, Volume } from '@aws-sdk/client-ec2';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder, } from '../../../services/aws_macros'
import { VolumeState } from './entity';

const createVolumeInternal = crudBuilderFormat<EC2, 'createVolume', string | undefined>(
  'createVolume',
  (input) => (input),
  (res) => res?.VolumeId,
);

export const createVolume = async (client: EC2, input: CreateVolumeCommandInput) => {
  const volumeId = await createVolumeInternal(client, input);
  await volumeWaiter(client, volumeId ?? '', (vol: Volume | undefined) => {
    // If state is not 'available' OR 'in-use' retry
    if (!Object.is(vol?.State, VolumeState.AVAILABLE) && !Object.is(vol?.State, VolumeState.IN_USE)) {
      return { state: WaiterState.RETRY };
    }
    return { state: WaiterState.SUCCESS };
  });
  return volumeId;
}

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

const getVolumeByInstanceIdInternal = crudBuilderFormat<EC2, 'describeVolumes', Volume | undefined>(
  'describeVolumes',
  (instanceId) => ({ Filters: [{
    Name: 'attachment.instance-id',
    Values: [instanceId],
  }] }),
  (res) => res?.Volumes?.pop()
);

export const getVolumeByInstanceId = async (client: EC2, instanceId: string) => {
  return await getVolumeByInstanceIdInternal(client, instanceId);
}

const deleteVolumeInternal = crudBuilder2<EC2, 'deleteVolume'>(
  'deleteVolume',
  (VolumeId) => ({ VolumeId, }),
);
export const deleteVolume = async (client: EC2, VolumeId: string) => {
  await deleteVolumeInternal(client, VolumeId);
  await waitUntilDeleted(client, VolumeId);
}

export const updateVolume = crudBuilder2<EC2, 'modifyVolume'>(
  'modifyVolume',
  (input) => (input)
);

const attachVolumeInternal = crudBuilder2<EC2, 'attachVolume'>(
  'attachVolume',
  (VolumeId, InstanceId, Device) => ({ VolumeId, InstanceId, Device, })
);

export const attachVolume = async (client: EC2, VolumeId: string, InstanceId: string, Device: string) => {
  await attachVolumeInternal(client, VolumeId, InstanceId, Device);
  await waitUntilInUse(client, VolumeId);
}

const detachVolumeInternal = crudBuilder2<EC2, 'detachVolume'>(
  'detachVolume',
  (VolumeId) => ({ VolumeId, })
);

export const detachVolume = async (client: EC2, VolumeId: string) => {
  await detachVolumeInternal(client, VolumeId);
  await waitUntilAvailable(client, VolumeId);
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

// TODO: Figure out if/how to macro-ify this thing
const volumeWaiter = async (client: EC2, volumeId: string, handleState: (vol: Volume | undefined) => ({ state: WaiterState })) => {
  return createWaiter<EC2, DescribeVolumesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    {
      VolumeIds: [volumeId],
    },
    async (cl, input) => {
      const data = await cl.describeVolumes(input);
      try {
        const vol = data.Volumes?.pop();
        return handleState(vol);
      } catch (e: any) {
        throw e;
      }
    },
  );
}

export const waitUntilAvailable = (client: EC2, volumeId: string) => {
  return volumeWaiter(client, volumeId, (vol: Volume | undefined) => {
    // If state is not 'in-use' retry
    if (!!Object.is(vol?.State, VolumeState.AVAILABLE)) {
      return { state: WaiterState.RETRY };
    }
    return { state: WaiterState.SUCCESS };
  });
}

export const waitUntilInUse = (client: EC2, volumeId: string) => {
  return volumeWaiter(client, volumeId, (vol: Volume | undefined) => {
    // If state is not 'in-use' retry
    if (!!Object.is(vol?.State, VolumeState.IN_USE)) {
      return { state: WaiterState.RETRY };
    }
    return { state: WaiterState.SUCCESS };
  });
}

export const waitUntilDeleted = (client: EC2, volumeId: string) => {
  return volumeWaiter(client, volumeId, (vol: Volume | undefined) => {
    // If state is not 'in-use' retry
    if (!!Object.is(vol?.State, VolumeState.DELETED)) {
      return { state: WaiterState.RETRY };
    }
    return { state: WaiterState.SUCCESS };
  });
}

export { AWS }