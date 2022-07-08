import {
  EC2,
  RunInstancesCommandInput,
  DescribeInstancesCommandInput,
  paginateDescribeInstances,
  Tag as AWSTag,
  Volume as AWSVolume,
  CreateVolumeCommandInput,
  ModifyVolumeCommandInput,
  paginateDescribeVolumes,
  DescribeVolumesCommandInput,
  DescribeVolumesModificationsCommandInput,
} from '@aws-sdk/client-ec2'
import {
  ElasticLoadBalancingV2,
  paginateDescribeTargetGroups,
  TargetTypeEnum,
} from '@aws-sdk/client-elastic-load-balancing-v2'
import { SSM } from '@aws-sdk/client-ssm';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder, } from '../../../services/aws_macros'
import { VolumeState } from './entity';


export const getInstanceUserData = crudBuilderFormat<EC2, 'describeInstanceAttribute', string | undefined>(
  'describeInstanceAttribute',
  (InstanceId) => ({ Attribute: 'userData', InstanceId, }),
  (res) => res?.UserData?.Value,
);

// TODO: Macro-ify the waiter usage
export const newInstance = async (client: EC2, newInstancesInput: RunInstancesCommandInput): Promise<string>  => {
  const create = await client.runInstances(newInstancesInput);
  const instanceIds: string[] | undefined = create.Instances?.map((i) => i?.InstanceId ?? '');
  const input: DescribeInstancesCommandInput = {
    InstanceIds: instanceIds,
  };
  // TODO: should we use the paginator instead?
  await createWaiter<EC2, DescribeInstancesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    input,
    async (cl, cmd) => {
      try {
        const data = await cl.describeInstances(cmd);
        for (const reservation of data?.Reservations ?? []) {
          for (const instance of reservation?.Instances ?? []) {
            if (instance.PublicIpAddress === undefined || instance.State?.Name !== 'running')
              return { state: WaiterState.RETRY };
          }
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        if (e.Code === 'InvalidInstanceID.NotFound')
          return { state: WaiterState.RETRY };
        throw e;
      }
    },
  );
  return instanceIds?.pop() ?? '';
}

export const describeInstances = crudBuilder2<EC2, 'describeInstances'>(
  'describeInstances',
  (InstanceIds) => ({ InstanceIds, }),
);

export const getInstance = async (client: EC2, id: string) => {
  const reservations = await describeInstances(client, [id]);
  return (reservations?.Reservations?.map((r: any) => r.Instances) ?? []).pop()?.pop();
}

export const getInstances = paginateBuilder<EC2>(paginateDescribeInstances, 'Instances', 'Reservations');
// TODO: Macro-ify this somehow?
export const updateTags = async (client: EC2, resourceId: string, tags?: { [key: string] : string }) => {
  let tgs: AWSTag[] = [];
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

// TODO: More to fix
export const startInstance = async (client: EC2, instanceId: string) => {
  await client.startInstances({
    InstanceIds: [instanceId],
  });
  const input: DescribeInstancesCommandInput = {
    InstanceIds: [instanceId],
  };
  await createWaiter<EC2, DescribeInstancesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    input,
    async (cl, cmd) => {
      try {
        const data = await cl.describeInstances(cmd);
        for (const reservation of data?.Reservations ?? []) {
          for (const instance of reservation?.Instances ?? []) {
            if (instance.State?.Name !== 'running')
              return { state: WaiterState.RETRY };
          }
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        if (e.Code === 'InvalidInstanceID.NotFound')
          return { state: WaiterState.SUCCESS };
        throw e;
      }
    },
  );
}

// TODO: Macro-ify this
export const stopInstance = async (client: EC2, instanceId: string, hibernate = false) => {
  await client.stopInstances({
    InstanceIds: [instanceId],
    Hibernate: hibernate,
  });
  const input: DescribeInstancesCommandInput = {
    InstanceIds: [instanceId],
  };
  await createWaiter<EC2, DescribeInstancesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    input,
    async (cl, cmd) => {
      try {
        const data = await cl.describeInstances(cmd);
        for (const reservation of data?.Reservations ?? []) {
          for (const instance of reservation?.Instances ?? []) {
            if (instance.State?.Name !== 'stopped')
              return { state: WaiterState.RETRY };
          }
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        if (e.Code === 'InvalidInstanceID.NotFound')
          return { state: WaiterState.SUCCESS };
        throw e;
      }
    },
  );
}

export const terminateInstance = crudBuilderFormat<EC2, 'terminateInstances', undefined>(
  'terminateInstances',
  (id) => ({ InstanceIds: [id], }),
  (_res) => undefined,
);

export const registerInstance = crudBuilderFormat<ElasticLoadBalancingV2, 'registerTargets', undefined>(
  'registerTargets',
  (Id: string, TargetGroupArn: string, Port?: number) => {
    const target: any = {
      Id,
    };
    if (Port) target.Port = Port;
    return {
      TargetGroupArn,
      Targets: [target],
    }
  },
  (_res) => undefined,
);

export const getTargetGroups = paginateBuilder<ElasticLoadBalancingV2>(
  paginateDescribeTargetGroups,
  'TargetGroups',
);

// TODO: Macro-ify this
export const getRegisteredInstances = async (client: ElasticLoadBalancingV2) => {
  const targetGroups = await getTargetGroups(client);
  const instanceTargetGroups = targetGroups.filter(tg => Object.is(tg.TargetType, TargetTypeEnum.INSTANCE)) ?? [];
  const out = [];
  for (const tg of instanceTargetGroups) {
    const res = await client.describeTargetHealth({
      TargetGroupArn: tg.TargetGroupArn,
    });
    out.push(...(res.TargetHealthDescriptions?.map(thd => (
      {
        targetGroupArn: tg.TargetGroupArn,
        instanceId: thd.Target?.Id,
        port: thd.Target?.Port,
      }
    )) ?? []));
  }
  return out;
}

export const getRegisteredInstance = crudBuilderFormat<
  ElasticLoadBalancingV2,
  'describeTargetHealth',
  { targetGroupArn: string, instanceId: string | undefined, port: number | undefined, } | undefined
>(
  'describeTargetHealth',
  (Id: string, TargetGroupArn: string, Port?: string) => {
    const target: any = { Id, };
    if (Port) target.Port = Port;
    return {
      TargetGroupArn,
      Targets: [target],
    };
  },
  (res, _Id, TargetGroupArn, _Port?) => [
    ...(res?.TargetHealthDescriptions?.map(thd => ({
      targetGroupArn: TargetGroupArn,
      instanceId: thd.Target?.Id,
      port: thd.Target?.Port,
    })) ?? [])
  ].pop(),
);

export const deregisterInstance = crudBuilderFormat<ElasticLoadBalancingV2, 'deregisterTargets', undefined>(
  'deregisterTargets',
  (Id: string, TargetGroupArn: string, Port?: number) => {
    const target: any = {
      Id,
    };
    if (Port) target.Port = Port;
    return {
      TargetGroupArn,
      Targets: [target],
    }
  },
  (_res) => undefined,
);

const createVolumeInternal = crudBuilderFormat<EC2, 'createVolume', string | undefined>(
  'createVolume',
  (input) => (input),
  (res) => res?.VolumeId,
);

export const createVolume = async (client: EC2, input: CreateVolumeCommandInput) => {
  const volumeId = await createVolumeInternal(client, input);
  await volumeWaiter(client, volumeId ?? '', (vol: AWSVolume | undefined) => {
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

export const getVolume = crudBuilderFormat<EC2, 'describeVolumes', AWSVolume | undefined>(
  'describeVolumes',
  (VolumeId) => ({ VolumeIds: [VolumeId] }),
  (res) => res?.Volumes?.pop()
);

const getVolumesByInstanceIdInternal = crudBuilderFormat<EC2, 'describeVolumes', AWSVolume[] | undefined>(
  'describeVolumes',
  (instanceId) => ({ Filters: [{
    Name: 'attachment.instance-id',
    Values: [instanceId],
  }] }),
  (res) => res?.Volumes
);

export const getVolumesByInstanceId = (client: EC2, instanceId: string) => {
  return getVolumesByInstanceIdInternal(client, instanceId);
}

const deleteVolumeInternal = crudBuilder2<EC2, 'deleteVolume'>(
  'deleteVolume',
  (VolumeId) => ({ VolumeId, }),
);
export const deleteVolume = async (client: EC2, VolumeId: string) => {
  await deleteVolumeInternal(client, VolumeId);
  await waitUntilDeleted(client, VolumeId);
}

const updateVolumeInternal = crudBuilder2<EC2, 'modifyVolume'>(
  'modifyVolume',
  (input) => (input)
);

export const updateVolume = async (client: EC2, input: ModifyVolumeCommandInput) => {
  await updateVolumeInternal(client, input);
  await waitUntilModificationsComplete(client, input.VolumeId ?? '');
}

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
const volumeWaiter = async (client: EC2, volumeId: string, handleState: (vol: AWSVolume | undefined) => ({ state: WaiterState })) => {
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
  return volumeWaiter(client, volumeId, (vol: AWSVolume | undefined) => {
    // If state is not 'in-use' retry
    if (!Object.is(vol?.State, VolumeState.AVAILABLE)) {
      return { state: WaiterState.RETRY };
    }
    return { state: WaiterState.SUCCESS };
  });
}

export const waitUntilInUse = (client: EC2, volumeId: string) => {
  return volumeWaiter(client, volumeId, (vol: AWSVolume | undefined) => {
    // If state is not 'in-use' retry
    if (!Object.is(vol?.State, VolumeState.IN_USE)) {
      return { state: WaiterState.RETRY };
    }
    return { state: WaiterState.SUCCESS };
  });
}

export const waitUntilDeleted = (client: EC2, volumeId: string) => {
  return volumeWaiter(client, volumeId, (vol: AWSVolume | undefined) => {
    // If state is not 'in-use' retry
    if (!Object.is(vol?.State, VolumeState.DELETED)) {
      return { state: WaiterState.RETRY };
    }
    return { state: WaiterState.SUCCESS };
  });
}

export const waitUntilModificationsComplete = (client: EC2, volumeId: string) => {
  return createWaiter<EC2, DescribeVolumesModificationsCommandInput>(
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
      const data = await cl.describeVolumesModifications(input);
      try {
        const volModif = data.VolumesModifications?.pop();
        // If state is not 'completed' or 'failed' retry
        if (!Object.is(volModif?.ModificationState, 'completed') && !Object.is(volModif?.ModificationState, 'failed')) {
          return { state: WaiterState.RETRY };
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        throw e;
      }
    },
  );
}

export const getParameter = crudBuilder2<SSM, 'getParameter'>(
  'getParameter',
  (Name) => ({ Name })
);

export const describeImages = crudBuilder2<EC2, 'describeImages'>(
  'describeImages',
  (ImageIds) => ({
    ImageIds,
  })
);

export { AWS }
