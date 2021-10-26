import { AWS, } from '../../services/gateways/aws'
import { AwsSecurityGroup, AwsSecurityGroupRule, } from './entity'
import { MapperInterface, ModuleInterface, } from '../interfaces'
import { TypeormWrapper, } from '../../services/typeorm'
import { awsSecurityGroup1635288398482, } from './migration/1635288398482-aws_security_group'

export const AwsSecurityGroupModule: ModuleInterface = {
  name: 'aws_security_group',
  dependencies: ['aws_account'],
  provides: {
    tables: ['aws_security_group', 'aws_security_group_rule'],
  },
  mappers: [{
    entity: AwsSecurityGroup,
    db: {
      create: async (e: AwsSecurityGroup, client: TypeormWrapper) => { await client.save(AwsSecurityGroup, e); },
      read: (client: TypeormWrapper, options: any) => client.find(AwsSecurityGroup, options),
      update: async (e: AwsSecurityGroup, client: TypeormWrapper) => { await client.save(AwsSecurityGroup, e); },
      delete: async (e: AwsSecurityGroup, client: TypeormWrapper) => { await client.remove(AwsSecurityGroup, e); },
    },
    cloud: {
      // We don't actually connect to AWS for this module, because it's meta
      create: async (_e: AwsSecurityGroup, _client: AWS) => {},
      read: async (_client: AWS) => [],
      update: async (_e: AwsSecurityGroup, _client: AWS) => {},
      delete: async (_e: AwsSecurityGroup, _client: AWS) => {},
    },
  } as MapperInterface<AwsSecurityGroup, TypeormWrapper, AWS>, {
    entity: AwsSecurityGroupRule,
    db: {
      create: async (e: AwsSecurityGroupRule, client: TypeormWrapper) => { await client.save(AwsSecurityGroupRule, e); },
      read: (client: TypeormWrapper, options: any) => client.find(AwsSecurityGroupRule, options),
      update: async (e: AwsSecurityGroupRule, client: TypeormWrapper) => { await client.save(AwsSecurityGroupRule, e); },
      delete: async (e: AwsSecurityGroupRule, client: TypeormWrapper) => { await client.remove(AwsSecurityGroupRule, e); },
    },
    cloud: {
      // We don't actually connect to AWS for this module, because it's meta
      create: async (_e: AwsSecurityGroupRule, _client: AWS) => {},
      read: async (_client: AWS) => [],
      update: async (_e: AwsSecurityGroupRule, _client: AWS) => {},
      delete: async (_e: AwsSecurityGroupRule, _client: AWS) => {},
    },
  } as MapperInterface<AwsSecurityGroupRule, TypeormWrapper, AWS>],
  migrations: {
    postinstall: awsSecurityGroup1635288398482.prototype.up,
    preremove: awsSecurityGroup1635288398482.prototype.down,
  },
};
