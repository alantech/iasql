import { Instance as InstanceAWS, } from '@aws-sdk/client-ec2'

import { AMI, Instance, InstanceType, Region, SecurityGroup, } from '../entity'
import { AMIMapper, InstanceTypeMapper, RegionMapper, SecurityGroupMapper } from '.'
import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const InstanceMapper: EntityMapper = new EntityMapper(Instance, {
  instanceId: (instance: InstanceAWS) => instance?.InstanceId ?? null,
  ami: async (instance: InstanceAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (instance?.ImageId) {
      const ami = await indexes.getOr(AMI, instance.ImageId, awsClient.getAMI.bind(awsClient));
      return await AMIMapper.fromAWS(ami, awsClient, indexes);
    } else {
      return null;
    }
  },
  instanceType: async (instance: InstanceAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (instance?.InstanceType) {
      const instanceType = await indexes.getOr(InstanceType, instance.InstanceType, awsClient.getInstanceType.bind(awsClient));
      return await InstanceTypeMapper.fromAWS(instanceType, awsClient, indexes);
    } else {
      return null;
    }
  },
  securityGroups: async (instance: InstanceAWS, awsClient: AWS, indexes: IndexedAWS) =>
    instance?.SecurityGroups?.length ?
      await Promise.all(instance?.SecurityGroups?.map(async (sg) => {
        const sgEntity = await indexes.getOr(SecurityGroup, sg.GroupId ?? '', awsClient.getSecurityGroup.bind(awsClient));
        return await SecurityGroupMapper.fromAWS(sgEntity, awsClient, indexes);
      })) : [],
  region: async (_instance: InstanceAWS, awsClient: AWS, indexes: IndexedAWS) => {
    // TODO: Proper multiregion support
    return await RegionMapper.fromAWS(awsClient.region, awsClient, indexes);
  },
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const instances = ((await awsClient.getInstances())?.Instances ?? []).filter((i: any) => i.State.Code < 32); // TODO: Remove this filter
    indexes.setAll(Instance, instances, 'InstanceId');
    const t2 = Date.now();
    console.log(`Instances set in ${t2 - t1}ms`);
  },
  createAWS: async (obj: any, awsClient: AWS, indexes: IndexedAWS) => {
    // First construct the instance
    const result = await awsClient.newInstance(obj.instanceType.instanceType.name, obj.ami.imageId, obj.securityGroups.map((sg: any) => sg.groupId));
    // TODO: Handle if it fails (somehow)
    if (!result) { // Failure
      throw new Error('what should we do here?');
    }
    // TODO: Determine if the following logic really belongs here or not
    const newInstance = await indexes.getOr(Instance, result ?? '', awsClient.getInstance.bind(awsClient));
    // We map this into the same kind of entity as `obj`
    const newEntity: Instance = await InstanceMapper.fromAWS(newInstance, awsClient, indexes);
    newEntity.id = obj.id;
    // Then we update the DB cache object with all of these properties so we can perform multiple
    // runs without re-querying the DB
    for (const key of Object.keys(newEntity)) {
      EntityMapper.keepId((obj as any)[key], (newEntity as any)[key]);
      (obj as any)[key] = (newEntity as any)[key];
    }
    // It's up to the caller if they want to actually update into the DB or not, though.
    return newEntity;
  },
  updateAWS: async (obj: any, awsClient: AWS, indexes: IndexedAWS) => {
    // TODO: The full set of properties for an Instance aren't defined yet. Some can be changed
    // whenever, like `securityGroups`, some can be changed by first stopping, changing, and then
    // starting it back up, like `instanceType`, and some cannot be changed without terminating and
    // completely rebuilding, like `region`. Eventually logic to detect which is which, with first
    // priority to the live updates, should be done, but for now we'll just treat every update as a
    // complete rebuild of the instance. At least for now this can be done as a create *followed by*
    // a delete, so we've got that going for us, which is nice.
    const oldEntity = { ...obj, }; // Make a shallow clone of the old record so we can do the create
                                   // first.
    const newEntity = await InstanceMapper.createAWS(obj, awsClient, indexes);
    await InstanceMapper.deleteAWS(oldEntity, awsClient, indexes);
    return newEntity;
  },
  deleteAWS: async (obj: any, awsClient: AWS, indexes: IndexedAWS) => {
    await awsClient.terminateInstance(obj.instanceId);
    // TODO: What does the error even look like? Docs are spotty on this
    indexes.del(Instance, (obj as any).instanceId);
    return obj;
  },
})
