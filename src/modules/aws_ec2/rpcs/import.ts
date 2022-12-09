import { EC2, ImportKeyPairCommandInput, waitUntilKeyPairExists } from '@aws-sdk/client-ec2';
import { WaiterOptions, WaiterState } from '@aws-sdk/util-waiter';

import { AwsEc2Module } from '..';
import { AWS } from '../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';

/**
 * Method for importing EC2 keypairs, based on a local one.
 *
 * Returns following columns:
 *
 * - name: The name for the created key
 * - status: OK if the certificate was imported successfully
 * - message: Error message in case of failure
 *
 * @example
 * ```sql
 * SELECT * FROM key_pair_import ('test-key', '<content_for_ssh_key>', 'us-east-1');
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ec2-integration.ts#L320
 * @see https://docs.aws.amazon.com/cli/latest/reference/ec2/import-key-pair.html
 *
 */
export class KeyPairImportRpc extends RpcBase {
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
  } as const;

  /**
   * @internal
   */
  async importKeyPair(client: EC2, input: ImportKeyPairCommandInput) {
    const res = await client.importKeyPair(input);
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
      if (result.state === WaiterState.SUCCESS) return res.KeyPairId;
    }
    return undefined;
  }

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    name: string,
    publicKey: string,
    region: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const client = (await ctx.getAwsClient(region)) as AWS;
    const textEncoder = new TextEncoder();
    const input: ImportKeyPairCommandInput = {
      KeyName: name,
      PublicKeyMaterial: textEncoder.encode(publicKey),
    };
    const importedKeyId = await this.importKeyPair(client.ec2client, input);
    if (!importedKeyId) {
      return [
        {
          name: '',
          status: 'ERROR',
          message: 'Error importing keypair',
        },
      ];
    }
    try {
      const importedKey = await this.module.keypair.cloud.read(ctx, name);
      importedKey.name = name;
      importedKey.region = region;

      if (importedKey) await this.module.keypair.db.create(importedKey, ctx);
      if (!importedKey) throw new Error('Failure loading the keypair');
    } catch (e: any) {
      return [
        {
          name: '',
          status: 'ERROR',
          message: e?.message ?? 'Failure loading the keypair',
        },
      ];
    }
    return [
      {
        name,
        status: 'OK',
        message: 'Imported the keypair successfully',
      },
    ];
  };

  constructor(module: AwsEc2Module) {
    super();
    this.module = module;
    super.init();
  }
}
