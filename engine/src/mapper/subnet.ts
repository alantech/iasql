import { Subnet as SubnetAWS} from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { Subnet, } from '../entity/subnet'
import { AvailabilityZone, Vpc } from '../entity'
import { AvailabilityZoneMapper, VpcMapper, } from '.'
import { DepError } from '../services/lazy-dep'

export const SubnetMapper = new EntityMapper(Subnet, {
  cidrBlock: (sn: SubnetAWS) => sn?.CidrBlock ?? null,
  state: (sn: SubnetAWS) => sn?.State ?? null,
  vpcId: async (sn: SubnetAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (sn?.VpcId) {
      const vpc = await indexes.getOr(Vpc, sn.VpcId, awsClient.getVpc.bind(awsClient));
      return await VpcMapper.fromAWS(vpc, awsClient, indexes);
    } else {
      return null;
    }
  },
  availabilityZone: async (sn: SubnetAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (sn?.AvailabilityZone) {
      const az = await indexes.getOr(AvailabilityZone, sn.AvailabilityZone, awsClient.getAvailabilityZoneByName.bind(awsClient));
      return await AvailabilityZoneMapper.fromAWS(az, awsClient, indexes);
    } else {
      return null;
    }
  },
  availableIpAddressCount: (sn: SubnetAWS) => sn?.AvailableIpAddressCount ?? null,
  subnetId: (sn: SubnetAWS) => sn?.SubnetId ?? null,
  ownerId: (sn: SubnetAWS) => sn?.OwnerId ?? null,
  subnetArn: (sn: SubnetAWS) => sn?.SubnetArn ?? null,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const vpcs = indexes.get(Vpc);
    if (!vpcs) throw new DepError('Vpc must be loaded first');
    const az = indexes.get(AvailabilityZone);
    if (!az) throw new DepError('AvailabilityZone must be loaded first');
    const subnets = (await awsClient.getSubnets())?.Subnets ?? [];
    indexes.setAll(Subnet, subnets, 'SubnetId');
    const t2 = Date.now();
    console.log(`Subnets set in ${t2 - t1}ms`);
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
