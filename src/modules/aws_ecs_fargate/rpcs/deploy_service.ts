import { ECS, UpdateServiceCommandInput } from '@aws-sdk/client-ecs';

import { AwsEcsFargateModule } from '..';
import { AWS } from '../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';
import { Service } from '../entity';

/**
 * Method to deploy a service using ECS fargate
 *
 * Returns following columns:
 * - arn: AWS ARN for the deployed service
 * - status: OK if the deployment succeeded
 * - message: The error message in case of errors
 *
 * Accepts the following parameters:
 * - arn: AWS ARN for the service to deploy
 *
 * @example
 * ```sql TheButton[Trigger the deployment of an ECS service]="Trigger the deployment of an ECS service"
 * SELECT deploy_service(arn) FROM service WHERE name='service_name';
 * ```
 *
 * @see https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-ecs-integration.ts#L686
 * @see https://aws.amazon.com/es/blogs/compute/building-deploying-and-operating-containerized-applications-with-aws-fargate/
 *
 */
export class DeployServiceRPC extends RpcBase {
  /**
   * @internal
   */
  module: AwsEcsFargateModule;

  /**
   * @internal
   */
  outputTable = {
    arn: 'varchar',
    status: 'varchar',
    message: 'varchar',
  } as const;

  /**
   * @internal
   */
  async updateService(client: ECS, input: UpdateServiceCommandInput) {
    const result = await client.updateService(input);
    return result?.service;
  }

  /**
   * @internal
   */
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    arn: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    if (!arn) {
      return [
        {
          arn: '',
          status: 'ERROR',
          message: 'Please provide the ARN of the service to redeploy',
        },
      ];
    }
    // given the service name, read the details
    const serviceObj: Service =
      (await this.module.service.db.read(ctx, this.module.service.generateId({ arn: arn ?? '' }))) ??
      (await this.module.service.cloud.read(ctx, this.module.service.generateId({ arn: arn ?? '' })));

    if (serviceObj) {
      const client = (await ctx.getAwsClient(serviceObj.region)) as AWS;

      const service = await this.updateService(client.ecsClient, {
        service: serviceObj.arn,
        cluster: serviceObj.cluster?.clusterArn,
        forceNewDeployment: true,
      });

      if (service) {
        // return ok
        const result = [
          {
            arn,
            status: 'OK',
            message: 'Service updated successfully',
          },
        ];
        return result;
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
