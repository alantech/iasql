import _ from 'lodash';

import { EC2 } from '@aws-sdk/client-ec2';

import { AwsEc2Module } from '..';
import { crudBuilder2 } from '../../../services/aws_macros';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcResponseObject,
} from '../../interfaces';

/**
 * Method for invoking an AWS EC2 SDK function
 */
export class InvokeRpc extends RpcBase {
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  postTransactionCheck = PostTransactionCheck.NO_CHECK;

  /**
   * @internal
   */
  module: AwsEc2Module;
  /**
   * @internal
   */
  outputTable = {
    result: 'varchar',
  } as const;

  /**
   * @internal
   */

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    methodName: string,
    argsString: string,
    region: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const client = (await ctx.getAwsClient(region)).ec2client as EC2;
    const methodAsType: keyof typeof client = methodName as keyof typeof client;
    const args = JSON.parse(argsString);
    const fn = crudBuilder2<typeof client, typeof methodAsType>(methodAsType, input => input);

    const res = await fn(client, args);
    return [
      {
        result: JSON.stringify(_.omit(res, ['$metadata'])),
      },
    ];
  };

  constructor(module: AwsEc2Module) {
    super();
    this.module = module;
    super.init();
  }
}
