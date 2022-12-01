import { CreateKeyPairCommandInput, EC2, waitUntilKeyPairExists } from '@aws-sdk/client-ec2';
import { KeyFormat, KeyType } from '@aws-sdk/client-ec2';
import { WaiterOptions, WaiterState } from '@aws-sdk/util-waiter';

import { AwsEc2Module } from '..';
import { AWS } from '../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';

export class KeyPairRequestRpc extends RpcBase {
  module: AwsEc2Module;
  outputTable = {
    name: 'varchar',
    status: 'varchar',
    message: 'varchar',
    privateKey: 'varchar',
  } as const;

  async requestKeyPair(client: EC2, input: CreateKeyPairCommandInput) {
    const res = await client.createKeyPair(input);
    if (res) {
      // wait until key exists
      const result = await waitUntilKeyPairExists(
        {
          client,
          // all in seconds
          maxWaitTime: 900,
          minDelay: 1,
          maxDelay: 4,
        } as WaiterOptions<EC2>,
        { KeyNames: [input.KeyName ?? ''] },
      );
      if (result.state === WaiterState.SUCCESS) return [res.KeyPairId, res.KeyMaterial];
    }
    return undefined;
  }

  call = async (
    dbId: string,
    _dbUser: string,
    ctx: Context,
    name: string,
    region: string,
    keyFormat?: string,
    keyType?: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const client = (await ctx.getAwsClient(region)) as AWS;
    const textEncoder = new TextEncoder();
    const input: CreateKeyPairCommandInput = {
      KeyName: name,
      KeyFormat: (keyFormat ?? 'pem') as KeyFormat,
      KeyType: (keyType ?? 'rsa') as KeyType,
    };
    const result = await this.requestKeyPair(client.ec2client, input);
    if (!result) {
      return [
        {
          name: '',
          status: 'ERROR',
          message: 'Error generating keypair',
          privateKey: '',
        },
      ];
    }
    try {
      const generatedKey = await this.module.keypair.cloud.read(ctx, name);
      generatedKey.name = name;
      generatedKey.region = region;

      if (generatedKey) await this.module.keypair.db.create(generatedKey, ctx);
      if (!generatedKey) throw new Error('Failure loading the keypair');
    } catch (e: any) {
      return [
        {
          name: '',
          status: 'ERROR',
          message: e?.message ?? 'Failure loading the keypair',
          privateKey: '',
        },
      ];
    }
    return [
      {
        name,
        status: 'OK',
        message: 'Generated the keypair successfully',
        privateKey: result[1],
      },
    ];
  };

  constructor(module: AwsEc2Module) {
    super();
    this.module = module;
    super.init();
  }
}
