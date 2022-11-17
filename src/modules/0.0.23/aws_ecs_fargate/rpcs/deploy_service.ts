import { ECS, UpdateServiceCommandInput } from '@aws-sdk/client-ecs';

import { AwsEcsFargateModule } from '..';
import { AWS } from '../../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../../interfaces';
import { Service } from '../entity';

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
    arn: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    // given the service name, read the details
    const serviceObj: Service =
      (await this.module.service.db.read(ctx, this.module.service.generateId({ arn: arn ?? '' }))) ??
      (await this.module.service.cloud.read(ctx, this.module.service.generateId({ arn: arn ?? '' })));

    if (serviceObj) {
      const client = (await ctx.getAwsClient(serviceObj.region)) as AWS;

      const service = await this.updateService(client.ecsClient, {
        service: serviceObj.arn,
        cluster: serviceObj.cluster?.clusterArn,
      });

      if (service) {
        // return ok
        return [
          {
            arn,
            status: 'OK',
            message: 'Service updated successfully',
          },
        ];
      } else {
        return [
          {
            arn: '',
            status: 'ERROR',
            message: 'Error updating service',
          },
        ];
      }
    } else {
      return [
        {
          arn: '',
          status: 'OK',
          message: 'Service not found',
        },
      ];
    }
  };

  constructor(module: AwsEcsFargateModule) {
    super();
    this.module = module;
    super.init();
  }
}
