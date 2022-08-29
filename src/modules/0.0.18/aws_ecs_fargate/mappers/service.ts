import { EC2, DescribeNetworkInterfacesCommandInput } from '@aws-sdk/client-ec2';
import {
  DescribeServicesCommandInput,
  ECS,
  Service as AwsService,
  paginateListServices,
} from '@aws-sdk/client-ecs';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AwsEcsFargateModule } from '..';
import { awsElbModule, awsSecurityGroupModule, awsVpcModule } from '../..';
import { AWS, crudBuilderFormat } from '../../../../services/aws_macros';
import logger from '../../../../services/logger';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { Subnet } from '../../aws_vpc/entity';
import { Service } from '../entity';

export class ServiceMapper extends MapperBase<Service> {
  module: AwsEcsFargateModule;
  entity = Service;
  equals = (a: Service, b: Service) =>
    Object.is(a.desiredCount, b.desiredCount) &&
    Object.is(a.task?.taskDefinitionArn, b.task?.taskDefinitionArn) &&
    Object.is(a.cluster?.clusterName, b.cluster?.clusterName) &&
    Object.is(a.arn, b.arn) &&
    Object.is(a.targetGroup?.targetGroupArn, b.targetGroup?.targetGroupArn) &&
    Object.is(a.name, b.name) &&
    Object.is(a.status, b.status) &&
    Object.is(a?.assignPublicIp, b?.assignPublicIp) &&
    Object.is(a?.securityGroups?.length, b?.securityGroups?.length) &&
    (a?.securityGroups?.every(asg => !!b?.securityGroups?.find(bsg => Object.is(asg.groupId, bsg.groupId))) ??
      false) &&
    Object.is(a?.subnets?.length, b?.subnets?.length) &&
    (a?.subnets?.every(asn => !!b?.subnets?.find(bsn => Object.is(asn, bsn))) ?? false) &&
    Object.is(a.forceNewDeployment, b.forceNewDeployment);

  updateService = crudBuilderFormat<ECS, 'updateService', AwsService | undefined>(
    'updateService',
    input => input,
    res => res?.service,
  );
  createService = crudBuilderFormat<ECS, 'createService', AwsService | undefined>(
    'createService',
    input => input,
    res => res?.service,
  );
  getService = crudBuilderFormat<ECS, 'describeServices', AwsService | undefined>(
    'describeServices',
    (id, cluster) => ({ services: [id], cluster }),
    res => res?.services?.[0],
  );

  // TODO: This a whole lot of tangled business logic baked into these functions. It may make sense
  // to decompose them in the future.
  async getServices(client: ECS, clusterIds: string[]) {
    const services = [];
    for (const id of clusterIds) {
      const serviceArns: string[] = [];
      const paginator = paginateListServices(
        {
          client,
        },
        {
          cluster: id,
          maxResults: 100,
        },
      );
      for await (const page of paginator) {
        serviceArns.push(...(page.serviceArns ?? []));
      }
      if (serviceArns.length) {
        const batchSize = 10; // Following AWS directions
        if (serviceArns.length > batchSize) {
          for (let i = 0; i < serviceArns.length; i += batchSize) {
            const batch = serviceArns.slice(i, i + batchSize);
            const result = await client.describeServices({
              cluster: id,
              services: batch,
            });
            services.push(...(result.services ?? []));
          }
        } else {
          const result = await client.describeServices({
            cluster: id,
            services: serviceArns,
          });
          services.push(...(result.services ?? []));
        }
      }
    }
    return services;
  }
  async deleteService(
    client: { ecsClient: ECS; ec2client: EC2 },
    name: string,
    cluster: string,
    tasksArns: string[],
  ) {
    await client.ecsClient.deleteService({
      service: name,
      cluster,
    });
    // We wait it is completely deleted to avoid issues deleting dependent resources.
    const input: DescribeServicesCommandInput = {
      services: [name],
      cluster,
    };
    await createWaiter<ECS, DescribeServicesCommandInput>(
      {
        client: client.ecsClient,
        // all in seconds
        maxWaitTime: 600,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (cl, cmd) => {
        const data = await cl.describeServices(cmd);
        if (data.services?.length && data.services[0].status === 'DRAINING') {
          return { state: WaiterState.RETRY };
        } else {
          return { state: WaiterState.SUCCESS };
        }
      },
    );
    try {
      const tasks = await client.ecsClient.describeTasks({ tasks: tasksArns, cluster });
      const taskAttachmentIds = tasks.tasks?.map(t => t.attachments?.map(a => a.id)).flat();
      if (taskAttachmentIds?.length) {
        const describeEniCommand: DescribeNetworkInterfacesCommandInput = {
          Filters: [
            {
              Name: 'description',
              Values: taskAttachmentIds?.map(id => `*${id}`),
            },
          ],
        };
        await createWaiter<EC2, DescribeNetworkInterfacesCommandInput>(
          {
            client: client.ec2client,
            // all in seconds
            maxWaitTime: 1200,
            // This operation need bigger delays since it takes time and we do not want to overload
            // AWS API
            minDelay: 30,
            maxDelay: 60,
          },
          describeEniCommand,
          async (cl, cmd) => {
            try {
              const eni = await cl.describeNetworkInterfaces(cmd);
              if (eni.NetworkInterfaces?.length) {
                return { state: WaiterState.RETRY };
              }
              return { state: WaiterState.SUCCESS };
            } catch (e) {
              return { state: WaiterState.RETRY };
            }
          },
        );
      }
    } catch (_) {
      // We should not throw here.
      // This is an extra validation to ensure that the service is fully deleted
      logger.info('Error getting network interfaces for tasks');
    }
  }
  async deleteServiceOnly(client: ECS, name: string, cluster: string) {
    await client.deleteService({
      service: name,
      cluster,
    });
    // We wait it is completely deleted to avoid issues deleting dependent resources.
    const input: DescribeServicesCommandInput = {
      services: [name],
      cluster,
    };
    await createWaiter<ECS, DescribeServicesCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 600,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (cl, cmd) => {
        const data = await cl.describeServices(cmd);
        if (data.services?.length && data.services[0].status === 'DRAINING') {
          return { state: WaiterState.RETRY };
        } else {
          return { state: WaiterState.SUCCESS };
        }
      },
    );
  }

  async serviceMapper(s: any, ctx: Context) {
    const out = new Service();
    out.arn = s.serviceArn;
    if (s.clusterArn) {
      out.cluster =
        (await this.module.cluster.db.read(ctx, s.clusterArn)) ??
        (await this.module.cluster.cloud.read(ctx, s.clusterArn));
    }
    out.desiredCount = s.desiredCount;
    const taskDefinition =
      (await this.module.taskDefinition.db.read(ctx, s.taskDefinition)) ??
      (await this.module.taskDefinition.cloud.read(ctx, s.taskDefinition));
    if (!taskDefinition) throw new Error('Task definitions need to be loaded first');
    out.task = taskDefinition;
    const serviceLoadBalancer = s.loadBalancers.pop();
    if (serviceLoadBalancer) {
      try {
        out.targetGroup =
          (await awsElbModule.targetGroup.db.read(ctx, serviceLoadBalancer.targetGroupArn)) ??
          (await awsElbModule.targetGroup.cloud.read(ctx, serviceLoadBalancer.targetGroupArn));
      } catch (_) {
        // Ignore if misconfigured
        if (!out.targetGroup) return undefined;
      }
    }
    out.name = s.serviceName;
    if (s.networkConfiguration?.awsvpcConfiguration) {
      const networkConf = s.networkConfiguration.awsvpcConfiguration;
      out.assignPublicIp = networkConf.assignPublicIp;
      const securityGroups = [];
      const cloudSecurityGroups = networkConf.securityGroups ?? [];
      for (const sg of cloudSecurityGroups) {
        securityGroups.push(
          (await awsSecurityGroupModule.securityGroup.db.read(ctx, sg)) ??
            (await awsSecurityGroupModule.securityGroup.cloud.read(ctx, sg)),
        );
      }
      if (securityGroups.filter(sg => !!sg).length !== cloudSecurityGroups.length)
        throw new Error('Security groups need to be loaded first');
      out.securityGroups = securityGroups;
      for (const sn of networkConf.subnets ?? []) {
        // Even though we already have the subnet ids, we look for them to avoid having
        // misconfigured resources
        let subnet: Subnet;
        try {
          subnet =
            (await awsVpcModule.subnet.db.read(ctx, sn)) ?? (await awsVpcModule.subnet.cloud.read(ctx, sn));
          if (!subnet) return undefined;
        } catch (e: any) {
          if (e.Code === 'InvalidSubnetID.NotFound') return undefined;
        }
      }
      out.subnets = networkConf.subnets ?? [];
    }
    out.status = s.status;
    out.forceNewDeployment = false;
    return out;
  }

  cloud: Crud2<Service> = new Crud2({
    create: async (es: Service[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const res = [];
      for (const e of es) {
        if (!e.task?.taskDefinitionArn) {
          throw new Error('task definition need to be created first');
        }
        const input: any = {
          serviceName: e.name,
          taskDefinition: e.task?.taskDefinitionArn,
          launchType: 'FARGATE',
          cluster: e.cluster?.clusterName,
          schedulingStrategy: 'REPLICA',
          desiredCount: e.desiredCount,
          networkConfiguration: {
            awsvpcConfiguration: {
              subnets: e.subnets?.length ? e.subnets : [],
              securityGroups: e.securityGroups.map(sg => sg.groupId!),
              assignPublicIp: e.assignPublicIp,
            },
          },
        };
        // Add load balancer to the first essential container. Theres always one essential
        // container definition.
        const essentialContainer = e.task.containerDefinitions.find(cd => cd.essential);
        if (e.targetGroup && essentialContainer?.containerPort) {
          input.loadBalancers = [
            {
              targetGroupArn: e.targetGroup?.targetGroupArn,
              containerName: essentialContainer?.name,
              containerPort: essentialContainer?.containerPort,
            },
          ];
        }
        const result = await this.createService(client.ecsClient, input);
        // TODO: Handle if it fails (somehow)
        if (!result?.hasOwnProperty('serviceName') || !result?.hasOwnProperty('clusterArn')) {
          // Failure
          throw new Error('what should we do here?');
        }
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getService(client.ecsClient, result.serviceName!, result.clusterArn!);
        // We map this into the same kind of entity as `obj`
        const newEntity = await this.serviceMapper(newObject, ctx);
        if (!newEntity) continue;
        // Save the record back into the database to get the new fields updated
        await this.module.service.db.update(newEntity, ctx);
        res.push(newEntity);
      }
      return res;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const services = ctx.memo?.cloud?.Service
          ? Object.values(ctx.memo?.cloud?.Service)
          : await this.module.service.cloud.read(ctx);
        const service = services?.find((s: any) => s?.arn === id);
        if (!service) return;
        const rawService = await this.getService(client.ecsClient, id, service.cluster.clusterArn);
        if (!rawService) return;
        return await this.serviceMapper(rawService, ctx);
      } else {
        const clusters = ctx.memo?.cloud?.Cluster
          ? Object.values(ctx.memo?.cloud?.Cluster)
          : await this.module.cluster.cloud.read(ctx);
        const result = await this.getServices(
          client.ecsClient,
          clusters?.map((c: any) => c.clusterArn) ?? [],
        );
        // Make sure we just handle FARGATE services
        const fargateResult = result.filter(s => s.launchType === 'FARGATE');
        const out = [];
        for (const s of fargateResult) {
          const mappedService = await this.serviceMapper(s, ctx);
          if (mappedService) out.push(mappedService);
        }
        return out;
      }
    },
    updateOrReplace: (prev: Service, next: Service) => {
      if (
        !(
          Object.is(prev.name, next.name) &&
          Object.is(prev.cluster?.clusterArn, next.cluster?.clusterArn) &&
          Object.is(prev?.assignPublicIp, next?.assignPublicIp) &&
          Object.is(prev?.securityGroups?.length, next?.securityGroups?.length) &&
          (prev?.securityGroups?.every(
            asg => !!next?.securityGroups?.find(bsg => Object.is(asg.groupId, bsg.groupId)),
          ) ??
            false) &&
          Object.is(prev?.subnets?.length, next?.subnets?.length) &&
          (prev?.subnets?.every(asn => !!next?.subnets?.find(bsn => Object.is(asn, bsn))) ?? false) &&
          Object.is(prev.targetGroup?.targetGroupArn, next.targetGroup?.targetGroupArn)
        )
      ) {
        return 'replace';
      }
      return 'update';
    },
    update: async (es: Service[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const res = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.Service?.[e.arn ?? ''];
        const isUpdate = this.module.service.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          // Desired count or task definition
          if (
            !(
              Object.is(e.desiredCount, cloudRecord.desiredCount) &&
              Object.is(e.task?.taskDefinitionArn, cloudRecord.task?.taskDefinitionArn) &&
              Object.is(e.forceNewDeployment, cloudRecord.forceNewDeployment)
            )
          ) {
            const updatedService = await this.updateService(client.ecsClient, {
              service: e.name,
              cluster: e.cluster?.clusterName,
              taskDefinition: e.task?.taskDefinitionArn,
              desiredCount: e.desiredCount,
              forceNewDeployment: e.forceNewDeployment,
            });
            const s = await this.serviceMapper(updatedService, ctx);
            if (!s) continue;
            await this.module.service.db.update(s, ctx);
            res.push(s);
            continue;
          }
          // Restore values
          await this.module.service.db.update(cloudRecord, ctx);
          res.push(cloudRecord);
          continue;
        } else {
          // We need to delete the current cloud record and create the new one.
          // The id in database will be the same `e` will keep it.
          await this.module.service.cloud.delete(cloudRecord, ctx);
          res.push(await this.module.service.cloud.create(e, ctx));
          continue;
        }
      }
      return res;
    },
    delete: async (es: Service[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const t0 = Date.now();
      for (const e of es) {
        const t1 = Date.now();
        e.desiredCount = 0;
        await this.updateService(client.ecsClient, {
          service: e.name,
          cluster: e.cluster?.clusterName,
          desiredCount: e.desiredCount,
        });
        const t2 = Date.now();
        logger.info(`Setting service ${e.name} desired count to 0 in ${t2 - t1}ms`);
        await this.deleteServiceOnly(client.ecsClient, e.name, e.cluster?.clusterArn!);
        const t3 = Date.now();
        logger.info(`Deleting service ${e.name} in ${t3 - t2}ms`);
      }
      const tn = Date.now();
      logger.info(`Service cloud mapper delete completed in ${tn - t0}ms`);
    },
  });

  constructor(module: AwsEcsFargateModule) {
    super();
    this.module = module;
    super.init();
  }
}
