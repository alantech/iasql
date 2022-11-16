import { ECS, UpdateServiceCommandInput } from '@aws-sdk/client-ecs';

import { AwsEcsFargateModule } from '..';
import { AWS } from '../../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';

export class DeployServiceRPC extends RpcBase {
  module: AwsEcsFargateModule;
  outputTable = {
    arn: 'varchar',
    status: 'varchar',
    message: 'varchar',
  } as const;

  async updateService(client: ECS, input: UpdateServiceCommandInput) {
    const result = await client.updateService(input);
    return result?.service;
  }

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    name: string,
    region: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const client = (await ctx.getAwsClient(region)) as AWS;
    const service = await this.updateService(client.ecsClient, {
      service: name,
    });

    if (service) {
      // return ok
      return [
        {
          arn: service.serviceArn,
          status: 'OK',
          message: 'Service updated successfully',
        },
      ];
    }
    return [
      {
        arn: '',
        status: 'ERROR',
        message: 'Error updating service',
      },
    ];
  };

  constructor(module: AwsEcsFargateModule) {
    super();
    this.module = module;
    super.init();
  }
}
