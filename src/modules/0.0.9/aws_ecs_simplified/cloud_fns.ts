import { AWS } from '../../../services/gateways/aws';
import cloudCreateFns from './cloud_create_fns';
import cloudDeleteFns from './cloud_delete_fns';

const cloudFns = {
  get: {
    defaultVpc: async (client: AWS) => {
      // Get default vpc
      const vpcs = (await client.getVpcs()).Vpcs ?? [];
      const defaultVpc = vpcs.find(vpc => vpc.IsDefault);
      return defaultVpc;
    },
    defaultSubnets: async (client: AWS, vpcId: string) => {
      // Get subnets
      const subnets = (await client.getSubnetsByVpcId(vpcId)).Subnets ?? [];
      return subnets;
    },
  },
  create: cloudCreateFns,
  delete: cloudDeleteFns,
};

export default cloudFns;