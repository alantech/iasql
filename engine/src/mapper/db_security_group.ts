import {
  DBSecurityGroup as DBSecurityGroupAWS,
  IPRange as IPRangeAWS,
} from '@aws-sdk/client-rds'
import { SecurityGroup as SecurityGroupAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { DBSecurityGroup, SecurityGroup, } from '../entity'
import { IPRangeMapper, SecurityGroupMapper } from '.'

export const DBSecurityGroupMapper: EntityMapper = new EntityMapper(DBSecurityGroup, {
  dbSecurityGroupDescription: (sg: DBSecurityGroupAWS, _i: IndexedAWS) => sg?.DBSecurityGroupDescription ?? null,
  dbSecurityGroupName: (sg: DBSecurityGroupAWS, _i: IndexedAWS) => sg?.DBSecurityGroupName ?? null,
  ownerId: (sg: DBSecurityGroupAWS, _i: IndexedAWS) => sg?.OwnerId ?? null,
  vpcId: (sg: DBSecurityGroupAWS, _i: IndexedAWS) => sg?.VpcId ?? null,
  ec2SecurityGroups: (dbsg: DBSecurityGroupAWS, i: IndexedAWS) => Object.values(
    i.get(SecurityGroup) as { [key: string]: SecurityGroupAWS }
  ).filter((sg: SecurityGroupAWS) => dbsg?.DBSecurityGroupName === sg?.GroupName)
    .map((sg: SecurityGroupAWS) => SecurityGroupMapper.fromAWS(sg, i)),
  IPRanges: (sg: DBSecurityGroupAWS, i: IndexedAWS) => 
    sg?.IPRanges?.length ?
    sg.IPRanges.map((ip: IPRangeAWS) => IPRangeMapper.fromAWS(ip, i)) 
    : [],
  dbSecurityGroupArn: (sg: DBSecurityGroupAWS, _i: IndexedAWS) => sg?.DBSecurityGroupArn ?? null,
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
