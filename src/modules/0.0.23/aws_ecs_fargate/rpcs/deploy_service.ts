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
    console.log('in deploy service');
    if (!arn) {
      console.log('no arn');
      return [
        {
          arn: '',
          status: 'ERROR',
          message: 'Please provide the ARN of the service to redeploy',
        },
      ];
    }
    // given the service name, read the details
    console.log('before service');
    const serviceObj: Service =
      (await this.module.service.db.read(ctx, this.module.service.generateId({ arn: arn ?? '' }))) ??
      (await this.module.service.cloud.read(ctx, this.module.service.generateId({ arn: arn ?? '' })));
    console.log('after service');

    if (serviceObj) {
      console.log('i start client');
      const client = (await ctx.getAwsClient(serviceObj.region)) as AWS;
      console.log('before update servcie');

      try {
        const service = await this.updateService(client.ecsClient, {
          service: serviceObj.arn,
          cluster: serviceObj.cluster?.clusterArn,
        });

        if (service) {
          console.log('i am ok');
          // return ok
          return [
            {
              arn,
              status: 'OK',
              message: 'Service updated successfully',
            },
          ];
        } else {
          console.log('error in update');
          return [
            {
              arn: '',
              status: 'ERROR',
              message: 'Error updating service',
            },
          ];
        }
      } catch (e) {
        console.log('Error in service');
        console.log(e);
        return [
          {
            arn: '',
            status: 'ERROR',
            message: 'Exception',
          },
        ];
      }
    } else {
      console.log('not found');
      return [
        {
          arn: '',
          status: 'ERROR',
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
