import { Instance as InstanceAWS, } from '@aws-sdk/client-ec2'

import { AMI, } from '../entity/ami';
import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'
import { Instance } from '../entity/instance';
import { AMIMapper, InstanceTypeMapper, SecurityGroupMapper } from '.';
import { InstanceType, SecurityGroup } from '../entity';

export const InstanceMapper = new EntityMapper(Instance, {
  instanceId: (instance: InstanceAWS, _indexes: IndexedAWS) => instance?.InstanceId ?? null,
  ami: (instance: InstanceAWS, indexes: IndexedAWS) =>
    instance?.ImageId ?
      AMIMapper.fromAWS(indexes.get(AMI, instance.ImageId), indexes) :
      null,
  instanceType: (instance: InstanceAWS, indexes: IndexedAWS) =>
    instance?.InstanceType ?
      InstanceTypeMapper.fromAWS(indexes.get(InstanceType, instance.InstanceType), indexes) :
      null,
  securityGroups: (instance: InstanceAWS, indexes: IndexedAWS) =>
    instance?.SecurityGroups?.length ?
      instance?.SecurityGroups?.map(sg => SecurityGroupMapper.fromAWS(indexes.get(SecurityGroup, sg.GroupId), indexes)) :
      [],
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const instances = (await awsClient.getInstances())?.Instances ?? [];
    indexes.setAll(Instance, instances, 'InstanceId');
    const t2 = Date.now();
    console.log(`Instances set in ${t2 - t1}ms`);
  },
  createAWS: async (obj: any, awsClient: AWS, indexes: IndexedAWS) => {
    // First construct the instance
    console.log('Obj', obj)
    const result = await awsClient.newInstance(obj.instanceType.instanceType.name, obj.ami.imageId, obj.securityGroups.map((sg: any) => sg.groupId));
    // TODO: Handle if it fails (somehow)
    if (!result) { // Failure
      throw new Error('what should we do here?');
    }
    // TODO: Determine if the following logic really belongs here or not
    const newInstance = await awsClient.getInstance(result ?? '');
    // We map this into the same kind of entity as `obj`
    const newEntity: Instance = InstanceMapper.fromAWS(newInstance, indexes);
    // We attach the original object's ID to this new one, indicating the exact record it is
    // replacing in the database
    newEntity.id = obj.id;
    // It's up to the caller if they want to actually update into the DB or not, though.
    return newEntity;
  },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
