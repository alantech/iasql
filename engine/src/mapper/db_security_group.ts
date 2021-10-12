import {
  DBSecurityGroup as DBSecurityGroupAWS,
  IPRange as IPRangeAWS,
} from '@aws-sdk/client-rds'
import { SecurityGroup as SecurityGroupAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { DBSecurityGroup, SecurityGroup, } from '../entity'
import { IPRangeMapper, SecurityGroupMapper, } from '.'

export const DBSecurityGroupMapper: EntityMapper = new EntityMapper(DBSecurityGroup, {
  dbSecurityGroupDescription: (sg: DBSecurityGroupAWS) => sg?.DBSecurityGroupDescription ?? null,
  dbSecurityGroupName: (sg: DBSecurityGroupAWS) => sg?.DBSecurityGroupName ?? null,
  ownerId: (sg: DBSecurityGroupAWS) => sg?.OwnerId ?? null,
  vpcId: (sg: DBSecurityGroupAWS) => sg?.VpcId ?? null,
  ec2SecurityGroups: async (dbsg: DBSecurityGroupAWS, awsClient: AWS, i: IndexedAWS) =>
    await Promise.all(Object.values(i.get(SecurityGroup) as { [key: string]: SecurityGroupAWS })
      .filter((sg: SecurityGroupAWS) => dbsg?.DBSecurityGroupName === sg?.GroupName)
      .map((sg: SecurityGroupAWS) => SecurityGroupMapper.fromAWS(sg, awsClient, i))),
  IPRanges: async (sg: DBSecurityGroupAWS, awsClient: AWS, i: IndexedAWS) =>
    sg?.IPRanges?.length ?
      await Promise.all(sg.IPRanges.map((ip: IPRangeAWS) => IPRangeMapper.fromAWS(ip, awsClient, i)))
      : [],
  dbSecurityGroupArn: (sg: DBSecurityGroupAWS) => sg?.DBSecurityGroupArn ?? null,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const dbSecurityGroups = (await awsClient.getDBSecurityGroups())?.DBSecurityGroups ?? [];
    indexes.setAll(DBSecurityGroup, dbSecurityGroups, 'GroupName');
    const t2 = Date.now();
    console.log(`DBSecurityGroups set in ${t2 - t1}ms`);
  },
  createAWS: async (_obj: SecurityGroup, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: SecurityGroup, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
});
