import { QueryRunner, } from 'typeorm'

import { AWS, } from '../../services/gateways/aws'
import { AwsAccountEntity, } from './entity'
import { MapperInterface, ModuleInterface, } from '../interfaces'
import { TypeormWrapper, } from '../../services/typeorm'

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
    postinstall: async (q: QueryRunner) => {
      await q.query(`CREATE TABLE "aws_account" ("id" SERIAL NOT NULL, "access_key_id" character varying NOT NULL, "secret_access_key" character varying NOT NULL, "region" character varying NOT NULL, CONSTRAINT "UQ_b590
44425928a1161cf75c8c491" UNIQUE ("access_key_id"), CONSTRAINT "UQ_15ef7447f0656b630dd129c345b" UNIQUE ("secret_access_key"), CONSTRAINT "PK_dd50eeb7ab9f2b49389ecd659f9" PRIMARY KEY ("id"))`);
    },
    preremove: async (q: QueryRunner) => {
      await q.query(`DROP TABLE "aws_account"`);
    },
  },
};
