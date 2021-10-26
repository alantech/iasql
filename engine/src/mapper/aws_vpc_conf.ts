import { AwsVpcConfiguration, } from '@aws-sdk/client-ecs'

import { AwsVpcConf, } from '../entity/aws_vpc_conf'
import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { SecurityGroup, Subnet } from '../entity'
import { SubnetMapper } from '.'

export const AwsVpcConfMapper = new EntityMapper(AwsVpcConf, {
  subnets: async (avc: AwsVpcConfiguration, awsClient: AWS, indexes: IndexedAWS) => {
    if (avc?.subnets?.length) {
      const subnets = await Promise.all(avc.subnets.map(s => indexes.getOr(Subnet, s, awsClient.getSubnet.bind(awsClient))));
      return await Promise.all(subnets.map(s => SubnetMapper.fromAWS(s, awsClient, indexes)));
    } else {
      return [];
    }
  },
  securityGroups: async (avc: AwsVpcConfiguration, awsClient: AWS, indexes: IndexedAWS) => {
    if (avc?.securityGroups?.length) {
      const securityGroups = await Promise.all(avc.securityGroups.map(sg => indexes.getOr(SecurityGroup, sg, awsClient.getSecurityGroup.bind(awsClient))));
      return await Promise.all(securityGroups.map(sg => SubnetMapper.fromAWS(sg, awsClient, indexes)));
    } else {
      return [];
    }
  },
  assignPublicIp: (avc: AwsVpcConfiguration) => avc?.assignPublicIp ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    return;
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
