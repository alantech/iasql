import { CreateKeyPairCommandInput, EC2, waitUntilKeyPairExists } from '@aws-sdk/client-ec2';
import { KeyFormat, KeyType } from '@aws-sdk/client-ec2';
import { WaiterOptions, WaiterState } from '@aws-sdk/util-waiter';

import { AwsEc2Module } from '..';
import { AWS } from '../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';

/**
 * Method for requesting a new EC2 keypair
 *
 * Returns following columns:
 *
 * - name: The name for the created key
 * - status: OK if the key was created successfully
 * - message: Error message in case of failure
 * - privateKey: Content of the private key. You will need to store it safely, as it won't be stored and shown again.
 *
 * @see https://docs.aws.amazon.com/cli/latest/reference/ec2/create-key-pair.html
 *
 */
export class KeyPairRequestRpc extends RpcBase {
  /**
   * @internal
   */
  module: AwsEc2Module;

  /**
   * @internal
   */
  outputTable = {
    name: 'varchar',
    status: 'varchar',
    message: 'varchar',
    privateKey: 'varchar',
  } as const;

  /**
   * @internal
   */
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
