import { QueryRunner, } from 'typeorm'

import { AWS, } from '../../services/gateways/aws'
import { AwsAccountEntity, } from './entity'
import { MapperInterface, ModuleInterface, } from '../interfaces'
import { TypeormWrapper, } from '../../services/typeorm'
import { awsAccount1635286464133, } from './migration/1635286464133-aws_account'

export const AwsAccount: ModuleInterface = {
  name: 'aws_account',
  dependencies: [],
  provides: {
    tables: ['aws_account'],
  },
  mappers: [{
    entity: AwsAccountEntity,
    db: {
      create: async (e: AwsAccountEntity, client: TypeormWrapper) => { await client.save(AwsAccountEntity, e); },
      read: (client: TypeormWrapper, options: any) => client.find(AwsAccountEntity, options),
      update: async (e: AwsAccountEntity, client: TypeormWrapper) => { await client.save(AwsAccountEntity, e); },
      delete: async (e: AwsAccountEntity, client: TypeormWrapper) => { await client.remove(AwsAccountEntity, e); },
    },
    cloud: {
      // We don't actually connect to AWS for this module, because it's meta
      create: async (_e: AwsAccountEntity, _client: AWS) => {},
      read: async (_client: AWS) => [],
      update: async (_e: AwsAccountEntity, _client: AWS) => {},
      delete: async (_e: AwsAccountEntity, _client: AWS) => {},
    },
  } as MapperInterface<AwsAccountEntity, TypeormWrapper, AWS>],
  migrations: {
    postinstall: awsAccount1635286464133.prototype.up,
    preremove: awsAccount1635286464133.prototype.down,
  },
};
