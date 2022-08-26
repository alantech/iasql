import { Service as AwsService } from '@aws-sdk/client-ecs';

import { AWS } from './aws';
import logger from '../../../services/logger';
import { EcsSimplified } from './entity';
import { Context, Crud2, Mapper2, Module2 } from '../../interfaces';
import * as metadata from './module.json';
import { SecurityGroup, SecurityGroupRule } from '../aws_security_group/entity';
import { Listener, LoadBalancer, TargetGroup } from '../aws_elb/entity';
import { LogGroup } from '../aws_cloudwatch/entity';
import { Repository } from '../aws_ecr/entity';
import { Role } from '../aws_iam/entity';
import {
  AssignPublicIp,
  Cluster,
  ContainerDefinition,
  CpuMemCombination,
  Service,
  TaskDefinition,
} from '../aws_ecs_fargate/entity';
import { PublicRepository } from '../aws_ecr/entity';
import cloudFns from './cloud_fns';
import simplifiedMappers from './simplified_mappers';
import { generateResourceName, processImageFromString } from './helpers';
import { awsAccount } from '../aws_account';

export type SimplifiedObjectMapped = {
  securityGroup: SecurityGroup;
  securityGroupRules: SecurityGroupRule[];
  targetGroup: TargetGroup;
  loadBalancer: LoadBalancer;
  listener: Listener;
  logGroup: LogGroup;
  repository?: Repository;
  pubRepository?: PublicRepository;
  role: Role;
  cluster: Cluster;
  taskDefinition: TaskDefinition;
  containerDefinition: ContainerDefinition;
  service: Service;
};

const prefix = 'iasql-ecs-';

// TODO: remove this once the aws gateway gets disolved
async function getAwsClient(ctx: Context): Promise<AWS> {
  const awsCreds = await ctx?.orm?.findOne(awsAccount.awsAccount.entity);
  return new AWS({
    region: awsCreds.region,
    credentials: {
      accessKeyId: awsCreds.accessKeyId,
      secretAccessKey: awsCreds.secretAccessKey,
    },
  });
}

export const AwsEcsSimplifiedModule: Module2 = new Module2(
  {
    ...metadata,
    utils: {
      ecsSimplifiedMapper: async (e: AwsService, ctx: Context) => {
        const client = (await getAwsClient(ctx)) as AWS;
        const out = new EcsSimplified();
        out.appName =
          e.serviceName?.substring(e.serviceName.indexOf(prefix) + prefix.length, e.serviceName.indexOf('-svc')) ?? '';
        out.desiredCount = e.desiredCount ?? 1;
        const serviceLoadBalancer = e.loadBalancers?.pop() ?? {};
        const targetGroup = await client.getTargetGroup(serviceLoadBalancer.targetGroupArn ?? '');
        const loadBalancer = (await client.getLoadBalancer(targetGroup?.LoadBalancerArns?.[0] ?? '')) ?? null;
        out.loadBalancerDns = loadBalancer?.DNSName;
        out.appPort = serviceLoadBalancer.containerPort ?? -1;
        out.publicIp = e.networkConfiguration?.awsvpcConfiguration?.assignPublicIp === AssignPublicIp.ENABLED;
        const taskDefinitionArn = e.taskDefinition ?? '';
        const taskDefinition = (await client.getTaskDefinition(taskDefinitionArn)) ?? {};
        out.cpuMem = `vCPU${+(taskDefinition.cpu ?? '256') / 1024}-${
          +(taskDefinition.memory ?? '512') / 1024
        }GB` as CpuMemCombination;
        const containerDefinition = taskDefinition.containerDefinitions?.pop();
        const image = processImageFromString(containerDefinition?.image ?? '');
        out.repositoryUri = image.repositoryUri;
        if (!!image.tag) out.imageTag = image.tag;
        if (!!image.digest) out.imageDigest = image.digest;
        return out;
      },
      isValid: async (service: AwsService, ctx: Context) => {
        try {
          // We use the service name as the appName
          const appName =
            service.serviceName?.substring(
              service.serviceName.indexOf(prefix) + prefix.length,
              service.serviceName.indexOf('-svc')
            ) ?? '';
          const client = (await getAwsClient(ctx)) as AWS;
          // Check if the cluster follow the name pattern
          const cluster = await client.getCluster(service.clusterArn ?? '');
          if (!Object.is(cluster?.clusterName, generateResourceName(prefix, appName, 'Cluster'))) return false;
          // Check if the cluster just have one service
          const services = await client.getServices([service.clusterArn ?? '']);
          if (services.length !== 1) return false;
          // Check load balancer count to be 1
          if (service.loadBalancers?.length !== 1) return false;
          // Check security groups count to be 1
          if (service.networkConfiguration?.awsvpcConfiguration?.securityGroups?.length !== 1) return false;
          // Check load balancer is valid
          const serviceLoadBalancerInfo = service.loadBalancers[0];
          const targetGroup = await client.getTargetGroup(serviceLoadBalancerInfo?.targetGroupArn ?? '');
          // Check target group name pattern
          if (!Object.is(targetGroup?.TargetGroupName, generateResourceName(prefix, appName, 'TargetGroup')))
            return false;
          const loadBalancer = await client.getLoadBalancer(targetGroup?.LoadBalancerArns?.[0] ?? '');
          // Check load balancer name pattern
          if (!Object.is(loadBalancer?.LoadBalancerName, generateResourceName(prefix, appName, 'LoadBalancer')))
            return false;
          // Check load balancer security group count
          if (loadBalancer?.SecurityGroups?.length !== 1) return false;
          const listeners = await client.getListeners([loadBalancer.LoadBalancerArn ?? '']);
          // Check listeners count
          if (listeners.Listeners.length !== 1) return false;
          // Check listener actions count
          if (listeners.Listeners?.[0]?.DefaultActions?.length !== 1) return false;
          // Check task definiton
          const taskDefinition = await client.getTaskDefinition(service.taskDefinition ?? '');
          // Check task definition pattern name
          if (!Object.is(taskDefinition?.family, generateResourceName(prefix, appName, 'TaskDefinition'))) return false;
          // Check container count
          if (taskDefinition?.containerDefinitions?.length !== 1) return false;
          const containerDefinition = taskDefinition.containerDefinitions[0];
          // Check container definition pattern name
          if (!Object.is(containerDefinition?.name, generateResourceName(prefix, appName, 'ContainerDefinition')))
            return false;
          // Get Security group
          const securityGroup = await client.getSecurityGroup(
            service.networkConfiguration?.awsvpcConfiguration?.securityGroups?.[0] ?? ''
          );
          // Check security group name pattern
          if (!Object.is(securityGroup.GroupName, generateResourceName(prefix, appName, 'SecurityGroup'))) return false;
          // Get security group rules
          const securityGroupRules = await client.getSecurityGroupRulesByGroupId(securityGroup.GroupId ?? '');
          // Check security group rule count
          if (securityGroupRules.SecurityGroupRules?.length !== 2) return false;
          // Get ingress rule port
          const securityGroupRuleIngress = securityGroupRules.SecurityGroupRules.find(sgr => !sgr.IsEgress);
          // Grab container port as appPort
          const appPort = containerDefinition?.portMappings?.[0].containerPort;
          // Check port configuration
          if (
            ![
              targetGroup?.Port,
              containerDefinition?.portMappings?.[0].hostPort,
              serviceLoadBalancerInfo?.containerPort,
              securityGroupRuleIngress?.ToPort,
              securityGroupRuleIngress?.FromPort,
            ].every(p => Object.is(p, appPort))
          )
            return false;
          // Check if role is valid
          if (!Object.is(taskDefinition.executionRoleArn, taskDefinition.taskRoleArn)) return false;
          const role = await client.getRole(generateResourceName(prefix, appName, 'Role'));
          const roleAttachedPoliciesArns = await client.getRoleAttachedPoliciesArnsV2(role?.RoleName ?? '');
          if (roleAttachedPoliciesArns?.length !== 1) return false;
          // Get cloudwatch log group
          const logGroups = await client.getLogGroups(
            containerDefinition?.logConfiguration?.options?.['awslogs-group'] ?? ''
          );
          if (logGroups.length !== 1) return false;
          // Check log group name pattern
          if (!Object.is(logGroups[0].logGroupName, generateResourceName(prefix, appName, 'LogGroup'))) return false;
          return true;
        } catch (_) {
          // If getting one of the components fails is not valid anymore
          return false;
        }
      },
      getSimplifiedObjectMapped: (e: EcsSimplified) => {
        const securityGroup = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.securityGroup(prefix, e.appName);
        const sgIngressRule = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.securityGroupRule(
          securityGroup,
          e.appPort,
          false
        );
        const sgEgressRule = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.securityGroupRule(
          securityGroup,
          e.appPort,
          true
        );
        const targetGroup = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.targetGroup(
          prefix,
          e.appName,
          e.appPort
        );
        const loadBalancer = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.loadBalancer(
          prefix,
          e.appName,
          securityGroup
        );
        const listener = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.listener(
          e.appPort,
          loadBalancer,
          targetGroup
        );
        const logGroup = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.logGroup(prefix, e.appName);
        let repository;
        if (!e.repositoryUri) {
          repository = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.repository(prefix, e.appName);
        }
        const role = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.role(prefix, e.appName);
        const cluster = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.cluster(prefix, e.appName);
        const taskDefinition = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.taskDefinition(
          prefix,
          e.appName,
          role,
          e.cpuMem
        );
        const containerDefinition = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.containerDefinition(
          prefix,
          e.appName,
          e.appPort,
          e.cpuMem,
          taskDefinition,
          logGroup,
          e.imageTag,
          e.imageDigest
        );
        const service = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.service(
          prefix,
          e.appName,
          e.desiredCount,
          e.publicIp,
          cluster,
          taskDefinition,
          targetGroup,
          securityGroup
        );
        const ecsSimplified: SimplifiedObjectMapped = {
          securityGroup,
          securityGroupRules: [sgIngressRule, sgEgressRule],
          targetGroup,
          loadBalancer,
          listener,
          logGroup,
          role,
          cluster,
          taskDefinition,
          containerDefinition,
          service,
        };
        if (!!repository) {
          ecsSimplified.repository = repository;
        }
        return ecsSimplified;
      },
      simplifiedEntityMapper: simplifiedMappers,
      cloud: cloudFns,
    },
    mappers: {
      ecsSimplified: new Mapper2<EcsSimplified>({
        entity: EcsSimplified,
        equals: (a: EcsSimplified, b: EcsSimplified) =>
          Object.is(a.appPort, b.appPort) &&
          Object.is(a.cpuMem, b.cpuMem) &&
          Object.is(a.desiredCount, b.desiredCount) &&
          Object.is(a.repositoryUri, b.repositoryUri) &&
          Object.is(a.imageTag, b.imageTag) &&
          Object.is(a.imageDigest, b.imageDigest) &&
          Object.is(a.loadBalancerDns, b.loadBalancerDns) &&
          Object.is(a.publicIp, b.publicIp),
        entityId: (e: EcsSimplified) => e.appName ?? '',
        source: 'db',
        cloud: new Crud2({
          create: async (es: EcsSimplified[], ctx: Context) => {
            const client = (await getAwsClient(ctx)) as AWS;
            const defaultVpc = await AwsEcsSimplifiedModule.utils.cloud.get.defaultVpc(client);
            const defaultSubnets = await AwsEcsSimplifiedModule.utils.cloud.get.defaultSubnets(
              client,
              defaultVpc.VpcId
            );
            const out: any[] = [];
            for (const e of es) {
              let step;
              const simplifiedObjectMapped: SimplifiedObjectMapped =
                AwsEcsSimplifiedModule.utils.getSimplifiedObjectMapped(e);
              // Container image
              // The next path implies a new repository needs to be created
              if (!!simplifiedObjectMapped.repository) {
                try {
                  await AwsEcsSimplifiedModule.utils.cloud.create.repository(client, simplifiedObjectMapped.repository);
                } catch (err) {
                  // Try to rollback on error
                  try {
                    await AwsEcsSimplifiedModule.utils.cloud.delete.repository(
                      client,
                      simplifiedObjectMapped.repository
                    );
                  } catch (_) {
                    // Do nothing, repositories could have images
                  }
                  throw err;
                }
              } else {
                // This branch implies a valid repository uri have been provided to be used
                simplifiedObjectMapped.containerDefinition.image = e.repositoryUri;
              }
              try {
                // security groups and security group rules
                await AwsEcsSimplifiedModule.utils.cloud.create.securityGroup(
                  client,
                  simplifiedObjectMapped.securityGroup,
                  defaultVpc
                );
                step = 'createSecurityGroup';
                await AwsEcsSimplifiedModule.utils.cloud.create.securityGroupRules(
                  client,
                  simplifiedObjectMapped.securityGroupRules
                );
                step = 'createSecurityGroupRules';
                // target group
                await AwsEcsSimplifiedModule.utils.cloud.create.targetGroup(
                  client,
                  simplifiedObjectMapped.targetGroup,
                  defaultVpc
                );
                step = 'createTargetGroup';
                // load balancer y lb security group
                await AwsEcsSimplifiedModule.utils.cloud.create.loadBalancer(
                  client,
                  simplifiedObjectMapped.loadBalancer,
                  defaultSubnets
                );
                step = 'createLoadBalancer';
                // listener
                await AwsEcsSimplifiedModule.utils.cloud.create.listener(client, simplifiedObjectMapped.listener);
                step = 'createListener';
                // cw log group
                await AwsEcsSimplifiedModule.utils.cloud.create.logGroup(client, simplifiedObjectMapped.logGroup);
                step = 'createLogGroup';
                // role
                await AwsEcsSimplifiedModule.utils.cloud.create.role(client, simplifiedObjectMapped.role);
                step = 'createRole';
                // cluster
                await AwsEcsSimplifiedModule.utils.cloud.create.cluster(client, simplifiedObjectMapped.cluster);
                step = 'createCluster';
                // task with container
                await AwsEcsSimplifiedModule.utils.cloud.create.taskDefinition(
                  client,
                  simplifiedObjectMapped.taskDefinition,
                  simplifiedObjectMapped.containerDefinition,
                  simplifiedObjectMapped.repository
                );
                step = 'createTaskDefinition';
                // service and serv sg
                await AwsEcsSimplifiedModule.utils.cloud.create.service(
                  client,
                  simplifiedObjectMapped.service,
                  simplifiedObjectMapped.containerDefinition,
                  defaultSubnets
                );
                step = 'createService';
                // Update ecs simplified record in database with the new load balancer dns
                e.loadBalancerDns = simplifiedObjectMapped.loadBalancer.dnsName;
                // Update ecs simplified record in database with the new ecr repository uri if needed
                if (!!simplifiedObjectMapped.repository) {
                  e.repositoryUri = simplifiedObjectMapped.repository.repositoryUri;
                }
                await AwsEcsSimplifiedModule.mappers.ecsSimplified.db.update(e, ctx);
                out.push(e);
              } catch (err: any) {
                logger.warn(
                  `Error creating ecs simplified resources. Rolling back on step ${step} with error: ${err.message}`
                );
                // Rollback
                try {
                  switch (step) {
                    case 'createService':
                      await AwsEcsSimplifiedModule.utils.cloud.delete.service(client, simplifiedObjectMapped.service);
                    case 'createTaskDefinition':
                      await AwsEcsSimplifiedModule.utils.cloud.delete.taskDefinition(
                        client,
                        simplifiedObjectMapped.taskDefinition
                      );
                    case 'createCluster':
                      await AwsEcsSimplifiedModule.utils.cloud.delete.cluster(client, simplifiedObjectMapped.cluster);
                    case 'createRole':
                      await AwsEcsSimplifiedModule.utils.cloud.delete.role(client, simplifiedObjectMapped.role);
                    case 'createLogGroup':
                      await AwsEcsSimplifiedModule.utils.cloud.delete.logGroup(client, simplifiedObjectMapped.logGroup);
                    case 'createListener':
                      await AwsEcsSimplifiedModule.utils.cloud.delete.listener(client, simplifiedObjectMapped.listener);
                    case 'createLoadBalancer':
                      await AwsEcsSimplifiedModule.utils.cloud.delete.loadBalancer(
                        client,
                        simplifiedObjectMapped.loadBalancer
                      );
                    case 'createTargetGroup':
                      await AwsEcsSimplifiedModule.utils.cloud.delete.targetGroup(
                        client,
                        simplifiedObjectMapped.targetGroup
                      );
                    case 'createSecurityGroupRules':
                      await AwsEcsSimplifiedModule.utils.cloud.delete.securityGroupRules(
                        client,
                        simplifiedObjectMapped.securityGroupRules
                      );
                    case 'createSecurityGroup':
                      await AwsEcsSimplifiedModule.utils.cloud.delete.securityGroup(
                        client,
                        simplifiedObjectMapped.securityGroup
                      );
                    default:
                      break;
                  }
                } catch (err2: any) {
                  err.message = `${err.message}. Could not rollback all entities created with error ${err2.message}`;
                }
                // Throw error
                throw err;
              }
            }
            return out;
          },
          read: async (ctx: Context, id?: string) => {
            const client = (await getAwsClient(ctx)) as AWS;
            // read all clusters and find the ones that match our pattern
            const clusters = await client.getClusters();
            const relevantClusters = clusters?.filter(c => c.clusterName?.includes(prefix)) ?? [];
            // read all services from relevant clusters
            let relevantServices = [];
            for (const c of relevantClusters) {
              const services = (await client.getServices([c.clusterName!])) ?? [];
              relevantServices.push(...services.filter(s => s.serviceName?.includes(prefix)));
            }
            if (id) {
              relevantServices = relevantServices.filter(s => s.serviceArn === id);
            }
            const validServices = [];
            for (const s of relevantServices) {
              const isValid = await AwsEcsSimplifiedModule.utils.isValid(s, ctx);
              if (isValid) validServices.push(s);
            }
            const out = [];
            for (const s of validServices) {
              out.push(await AwsEcsSimplifiedModule.utils.ecsSimplifiedMapper(s, ctx));
            }
            return out;
          },
          updateOrReplace: (prev: EcsSimplified, next: EcsSimplified) => {
            if (!(Object.is(prev?.appPort, next?.appPort) && Object.is(prev?.publicIp, next?.publicIp))) {
              return 'replace';
            }
            return 'update';
          },
          update: async (es: EcsSimplified[], ctx: Context) => {
            const client = (await getAwsClient(ctx)) as AWS;
            const out = [];
            for (const e of es) {
              const cloudRecord = ctx?.memo?.cloud?.EcsSimplified?.[e.appName ?? ''];
              const isUpdate =
                AwsEcsSimplifiedModule.mappers.ecsSimplified.cloud.updateOrReplace(cloudRecord, e) === 'update';
              if (isUpdate) {
                const isServiceUpdate = !(
                  Object.is(e.desiredCount, cloudRecord.desiredCount) &&
                  Object.is(e.cpuMem, cloudRecord.cpuMem) &&
                  Object.is(e.repositoryUri, cloudRecord.repositoryUri) &&
                  Object.is(e.imageTag, cloudRecord.imageTag) &&
                  Object.is(e.imageDigest, cloudRecord.imageDigest)
                );
                if (!isServiceUpdate) {
                  // Restore values
                  await AwsEcsSimplifiedModule.mappers.ecsSimplified.db.update(cloudRecord, ctx);
                  out.push(cloudRecord);
                  continue;
                }
                const simplifiedObjectMapped: SimplifiedObjectMapped =
                  AwsEcsSimplifiedModule.utils.getSimplifiedObjectMapped(e);
                // Desired count or task definition and container changes
                const updateServiceInput: any = {
                  service: simplifiedObjectMapped.service.name,
                  cluster: simplifiedObjectMapped.cluster.clusterName,
                  desiredCount: simplifiedObjectMapped.service.desiredCount,
                };
                // Create new ecr if needed
                if (!Object.is(e.repositoryUri, cloudRecord.repositoryUri) && !e.repositoryUri) {
                  // We first check if a repositroy with the expected name exists.
                  try {
                    const repository = await client.getECRRepository(
                      simplifiedObjectMapped.repository?.repositoryName ?? ''
                    );
                    if (!!repository) {
                      simplifiedObjectMapped.repository!.repositoryArn = repository.repositoryArn;
                      simplifiedObjectMapped.repository!.repositoryUri = repository.repositoryUri;
                    }
                  } catch (_) {
                    // If the repository does not exists we create it
                    await AwsEcsSimplifiedModule.utils.cloud.create.repository(
                      client,
                      simplifiedObjectMapped.repository
                    );
                  }
                }
                if (
                  !(
                    Object.is(e.cpuMem, cloudRecord.cpuMem) &&
                    Object.is(e.repositoryUri, cloudRecord.repositoryUri) &&
                    Object.is(e.imageTag, cloudRecord.imageTag) &&
                    Object.is(e.imageDigest, cloudRecord.imageDigest)
                  )
                ) {
                  // Get current task definition from service
                  const service = await client.getServiceByName(
                    simplifiedObjectMapped.cluster.clusterName,
                    simplifiedObjectMapped.service.name
                  );
                  const taskDefinition = await client.getTaskDefinition(service?.taskDefinition ?? '');
                  simplifiedObjectMapped.taskDefinition.taskRole!.arn = taskDefinition?.taskRoleArn;
                  simplifiedObjectMapped.taskDefinition.executionRole!.arn = taskDefinition?.executionRoleArn;
                  // If no new reporsitory, set image
                  if (!simplifiedObjectMapped.repository) {
                    simplifiedObjectMapped.containerDefinition.image = e.repositoryUri;
                  }
                  const logGroup = await client.getLogGroups(
                    taskDefinition?.containerDefinitions?.[0]?.logConfiguration?.options?.['awslogs-group']
                  );
                  simplifiedObjectMapped.logGroup.logGroupArn = logGroup[0].arn;
                  // Create new task definition
                  const newTaskDefinition = await AwsEcsSimplifiedModule.utils.cloud.create.taskDefinition(
                    client,
                    simplifiedObjectMapped.taskDefinition,
                    simplifiedObjectMapped.containerDefinition,
                    simplifiedObjectMapped.repository
                  );
                  // Set new task definition ARN to service input object
                  updateServiceInput.taskDefinition = newTaskDefinition.taskDefinitionArn ?? '';
                }
                const updatedService = await client.updateService(updateServiceInput);
                const ecsQs = await AwsEcsSimplifiedModule.utils.ecsSimplifiedMapper(updatedService, ctx);
                await AwsEcsSimplifiedModule.mappers.ecsSimplified.db.update(ecsQs, ctx);
                out.push(ecsQs);
              } else {
                await AwsEcsSimplifiedModule.mappers.ecsSimplified.cloud.delete([cloudRecord], ctx);
                const res = await AwsEcsSimplifiedModule.mappers.ecsSimplified.cloud.create([e], ctx);
                out.push(...res);
              }
            }
            return out;
          },
          delete: async (es: EcsSimplified[], ctx: Context) => {
            const client = (await getAwsClient(ctx)) as AWS;
            for (const e of es) {
              const simplifiedObjectMapped: SimplifiedObjectMapped =
                AwsEcsSimplifiedModule.utils.getSimplifiedObjectMapped(e);
              const service = await client.getServiceByName(
                simplifiedObjectMapped.cluster.clusterName,
                simplifiedObjectMapped.service.name
              );
              simplifiedObjectMapped.cluster.clusterArn = service?.clusterArn;
              simplifiedObjectMapped.securityGroup.groupId =
                service?.networkConfiguration?.awsvpcConfiguration?.securityGroups?.pop();
              simplifiedObjectMapped.taskDefinition.taskDefinitionArn = service?.taskDefinition;
              const serviceLoadBalancer = service?.loadBalancers?.pop();
              // Find load balancer
              simplifiedObjectMapped.targetGroup.targetGroupArn = serviceLoadBalancer?.targetGroupArn;
              const targetGroup = await client.getTargetGroup(simplifiedObjectMapped.targetGroup.targetGroupArn ?? '');
              simplifiedObjectMapped.loadBalancer.loadBalancerArn = targetGroup?.LoadBalancerArns?.pop();
              await AwsEcsSimplifiedModule.utils.cloud.delete.service(client, simplifiedObjectMapped.service);
              await AwsEcsSimplifiedModule.utils.cloud.delete.taskDefinition(
                client,
                simplifiedObjectMapped.taskDefinition
              );
              await AwsEcsSimplifiedModule.utils.cloud.delete.cluster(client, simplifiedObjectMapped.cluster);
              await AwsEcsSimplifiedModule.utils.cloud.delete.role(client, simplifiedObjectMapped.role);
              await AwsEcsSimplifiedModule.utils.cloud.delete.logGroup(client, simplifiedObjectMapped.logGroup);
              await AwsEcsSimplifiedModule.utils.cloud.delete.loadBalancer(client, simplifiedObjectMapped.loadBalancer);
              await AwsEcsSimplifiedModule.utils.cloud.delete.targetGroup(client, simplifiedObjectMapped.targetGroup);
              await AwsEcsSimplifiedModule.utils.cloud.delete.securityGroup(
                client,
                simplifiedObjectMapped.securityGroup
              );
              // Try to delete ECR if any
              if (!!simplifiedObjectMapped.repository) {
                try {
                  await AwsEcsSimplifiedModule.utils.cloud.delete.repository(client, simplifiedObjectMapped.repository);
                } catch (_) {
                  // Do nothing, repository could have images
                }
              } else {
                const image = processImageFromString(e.repositoryUri ?? '');
                // If pattern match, means that we create it and we should try to delete it
                if (
                  image.ecrRepositoryName &&
                  Object.is(image.ecrRepositoryName, generateResourceName(prefix, e.appName, 'Repository'))
                ) {
                  simplifiedObjectMapped.repository = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.repository(
                    prefix,
                    e.appName
                  );
                  try {
                    await AwsEcsSimplifiedModule.utils.cloud.delete.repository(
                      client,
                      simplifiedObjectMapped.repository
                    );
                  } catch (_) {
                    // Do nothing, repository could have images
                  }
                }
              }
            }
          },
        }),
      }),
    },
  },
  __dirname
);
