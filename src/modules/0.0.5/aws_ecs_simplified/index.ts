import { Service as AwsService } from '@aws-sdk/client-ecs'

import { AWS, } from '../../../services/gateways/aws'
import logger from '../../../services/logger'
import { EcsSimplified } from './entity'
import { Context, Crud, Mapper, Module, } from '../../interfaces'
import * as metadata from './module.json'
import { SecurityGroup, SecurityGroupRule } from '../../0.0.4/aws_security_group/entity'
import {
  Listener,
  LoadBalancer,
  TargetGroup,
} from '../../0.0.4/aws_elb/entity'
import { LogGroup } from '../../0.0.4/aws_cloudwatch/entity'
import { Repository } from '../../0.0.4/aws_ecr/entity'
import { Role } from '../../0.0.4/aws_iam/entity'
import {
  AssignPublicIp,
  Cluster,
  ContainerDefinition,
  CpuMemCombination,
  Service,
  TaskDefinition,
} from '../../0.0.4/aws_ecs_fargate/entity'
import { PublicRepository } from '../aws_ecr/entity'
import cloudFns from './cloud_fns';
import simplifiedMappers from './simplified_mappers';

export type EcsSimplifiedObject = {
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

export const AwsEcsSimplifiedModule: Module = new Module({
  ...metadata,
  utils: {
    ecsSimplifiedMapper: async (e: AwsService, ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = new EcsSimplified();
      out.appName = e.serviceName?.substring(e.serviceName.indexOf(prefix) + prefix.length, e.serviceName.indexOf('-svc')) ?? '';
      out.desiredCount = e.desiredCount;
      const serviceLoadBalancer = e.loadBalancers?.pop() ?? {};
      const targetGroup = await client.getTargetGroup(serviceLoadBalancer.targetGroupArn ?? '');
      const loadBalancer = await client.getLoadBalancer(targetGroup?.LoadBalancerArns?.[0] ?? '') ?? null;
      out.loadBalancerDns = loadBalancer?.DNSName;
      out.appPort = serviceLoadBalancer.containerPort ?? -1;
      out.publicIp = e.networkConfiguration?.awsvpcConfiguration?.assignPublicIp === AssignPublicIp.ENABLED;
      const taskDefinitionArn = e.taskDefinition ?? '';
      const taskDefinition = await client.getTaskDefinition(taskDefinitionArn) ?? {};
      out.cpuMem = `vCPU${+(taskDefinition.cpu ?? '256') / 1024}-${+(taskDefinition.memory ?? '512') / 1024}GB` as CpuMemCombination;
      const containerDefinition = taskDefinition.containerDefinitions?.pop();
      const image = AwsEcsSimplifiedModule.utils.processImageFromString(containerDefinition?.image);
      out.repositoryUri = image.repositoryUri;
      if (!!image.tag) out.imageTag = image.tag;
      if (!!image.digest) out.imageDigest = image.digest;
      return out;
    },
    processImageFromString: (image: string) => {
      const res: {
        repositoryUri?: string,
        tag?: string,
        digest?: string,
        isPrivateEcr?: boolean,
        isPublicEcr?: boolean,
        ecrRepositoryName?: string,
      } = {};
      if (image?.includes('@')) {  // Image with digest
        const split = image.split('@');
        res.repositoryUri = split[0];
        res.digest = split[1];
      } else if (image?.includes(':')) {  // Image with tag
        const split = image.split(':');
        res.repositoryUri = split[0];
        res.tag = split[1];
      } else {  // Just image name
        res.repositoryUri = image;
      }
      if (res.repositoryUri?.includes('amazonaws.com')) {  // Private ECR
        const parts = res.repositoryUri.split('/');
        const repositoryName = parts[parts.length - 1] ?? null;
        res.ecrRepositoryName = repositoryName;
        res.isPrivateEcr = true;
      } else if (res.repositoryUri?.includes('public.ecr.aws')) {  // Public ECR
        const parts = res.repositoryUri.split('/');
        const publicRepositoryName = parts[parts.length - 1] ?? null;
        res.ecrRepositoryName = publicRepositoryName;
        res.isPublicEcr = true;
      }
      return res;
    },
    isValid: async (service: AwsService, ctx: Context) => {
      // We use the service name as the appName
      const appName = service.serviceName?.substring(service.serviceName.indexOf(prefix) + prefix.length, service.serviceName.indexOf('-svc')) ?? '';
      const client = await ctx.getAwsClient() as AWS;
      // Check if the cluster follow the name pattern
      const cluster = await client.getCluster(service.clusterArn ?? '');
      if (!Object.is(cluster?.clusterName, `${prefix}${appName}-cl`)) return false;
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
      if (!Object.is(targetGroup?.TargetGroupName, `${prefix}${appName}-tg`)) return false;
      const loadBalancer = await client.getLoadBalancer(targetGroup?.LoadBalancerArns?.[0] ?? '');
      // Check load balancer name pattern
      if (!Object.is(loadBalancer?.LoadBalancerName, `${prefix}${appName}-lb`)) return false;
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
      if (!Object.is(taskDefinition?.family, `${prefix}${appName}-td`)) return false;
      // Check container count
      if (taskDefinition?.containerDefinitions?.length !== 1) return false;
      const containerDefinition = taskDefinition.containerDefinitions[0];
      // Check container definition pattern name
      if (!Object.is(containerDefinition?.name, `${prefix}${appName}-cd`)) return false;
      // Get Security group
      const securityGroup = await client.getSecurityGroup(service.networkConfiguration?.awsvpcConfiguration?.securityGroups?.[0] ?? '');
      // Check security group name pattern
      if (!Object.is(securityGroup.GroupName, `${prefix}${appName}-sg`)) return false;
      // Get security group rules
      const securityGroupRules = await client.getSecurityGroupRulesByGroupId(securityGroup.GroupId ?? '');
      // Check security group rule count
      if (securityGroupRules.SecurityGroupRules?.length !== 2) return false;
      // Get ingress rule port
      const securityGroupRuleIngress = securityGroupRules.SecurityGroupRules.find(sgr => !sgr.IsEgress);
      // Grab container port as appPort
      const appPort = containerDefinition?.portMappings?.[0].containerPort;
      // Check port configuration
      if (![targetGroup?.Port, containerDefinition?.portMappings?.[0].hostPort, serviceLoadBalancerInfo?.containerPort, securityGroupRuleIngress?.ToPort, securityGroupRuleIngress?.FromPort]
        .every(p => Object.is(p, appPort))) return false;
      // Check if role is valid
      if (!Object.is(taskDefinition.executionRoleArn, taskDefinition.taskRoleArn)) return false;
      const role = await client.getRole(`${prefix}${appName}-rl`);
      const roleAttachedPoliciesArns = await client.getRoleAttachedPoliciesArns(role?.RoleName ?? '');
      if (roleAttachedPoliciesArns.length !== 1) return false;
      // Get cloudwatch log group
      const logGroups = await client.getLogGroups(containerDefinition?.logConfiguration?.options?.["awslogs-group"] ?? '');
      if (logGroups.length !== 1) return false;
      // Check log group name pattern
      if (!Object.is(logGroups[0].logGroupName, `${prefix}${appName}-lg`)) return false;
      return true;
    },
    getEcsSimplifiedObject: (e: EcsSimplified) => {
      // TODO: improve variable naming
      // security groups and security group rules
      const sg = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.securityGroup(prefix, e.appName);
      const sgrIngress = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.securityGroupRule(sg, e.appPort, false);
      const sgrEgress = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.securityGroupRule(sg, e.appPort, true);
      // target group
      const tg = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.targetGroup(prefix, e.appName, e.appPort);
      // load balancer y lb security group
      const lb = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.loadBalancer(prefix, e.appName, sg);
      // listener
      const lsn = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.listener(e.appPort, lb, tg);
      // cw log group
      const lg = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.logGroup(prefix, e.appName);
      // ecr
      let repository;
      if (!e.repositoryUri) {
        repository = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.repository(prefix, e.appName);
      }
      // role
      const rl = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.role(prefix, e.appName);
      // cluster
      const cl = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.cluster(prefix, e.appName);
      // task and container
      const td = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.taskDefinition(prefix, e.appName, rl, e.cpuMem);
      const cd = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.containerDefinition(prefix, e.appName, e.appPort, e.cpuMem, td, lg, e.imageTag, e.imageDigest);
      // service
      const svc = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.service(prefix, e.appName, e.desiredCount, e.publicIp, cl, td, tg, sg)
      const ecsSimplified: EcsSimplifiedObject = {
        securityGroup: sg,
        securityGroupRules: [sgrIngress, sgrEgress],
        targetGroup: tg,
        loadBalancer: lb,
        listener: lsn,
        logGroup: lg,
        role: rl,
        cluster: cl,
        taskDefinition: td,
        containerDefinition: cd,
        service: svc,
      };
      if (!!repository) {
        ecsSimplified.repository = repository;
      }
      return ecsSimplified
    },
    simplifiedEntityMapper: simplifiedMappers,
    cloud: cloudFns,
  },
  mappers: {
    ecsSimplified: new Mapper<EcsSimplified>({
      entity: EcsSimplified,
      equals: (a: EcsSimplified, b: EcsSimplified) => Object.is(a.appPort, b.appPort) &&
        Object.is(a.cpuMem, b.cpuMem) &&
        Object.is(a.desiredCount, b.desiredCount) &&
        Object.is(a.repositoryUri, b.repositoryUri) &&
        Object.is(a.imageTag, b.imageTag) &&
        Object.is(a.imageDigest, b.imageDigest) &&
        Object.is(a.loadBalancerDns, b.loadBalancerDns) &&
        Object.is(a.publicIp, b.publicIp),
      entityId: (e: EcsSimplified) => e.appName ?? '', // todo: is this enough?
      source: 'db',
      cloud: new Crud({
        create: async (es: EcsSimplified[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const defaultVpc = await AwsEcsSimplifiedModule.utils.cloud.get.defaultVpc(client);
          const defaultSubnets = await AwsEcsSimplifiedModule.utils.cloud.get.defaultSubnets(client, defaultVpc.VpcId);
          const out: any[] = [];
          for (const e of es) {
            let step;
            const completeEcsSimplifiedObject: EcsSimplifiedObject = AwsEcsSimplifiedModule.utils.getEcsSimplifiedObject(e);
            // Container image
            // The next path implies a new repository needs to be created
            if (!!completeEcsSimplifiedObject.repository) {
              try {
                await AwsEcsSimplifiedModule.utils.cloud.create.repository(client, completeEcsSimplifiedObject.repository);
              } catch (err) {
                // Try to rollback on error
                try {
                  await AwsEcsSimplifiedModule.utils.cloud.delete.repository(client, completeEcsSimplifiedObject.repository);
                } catch (_) {
                  // Do nothing, repositories could have images
                }
                throw err;
              }
            } else {  // This branch implies a valid repository uri have been provided to be used
              completeEcsSimplifiedObject.containerDefinition.image = e.repositoryUri;
            }
            try {
              // security groups and security group rules
              await AwsEcsSimplifiedModule.utils.cloud.create.securityGroup(client, completeEcsSimplifiedObject.securityGroup, defaultVpc);
              step = 'createSecurityGroup';
              await AwsEcsSimplifiedModule.utils.cloud.create.securityGroupRules(client, completeEcsSimplifiedObject.securityGroupRules);
              step = 'createSecurityGroupRules';
              // target group
              await AwsEcsSimplifiedModule.utils.cloud.create.targetGroup(client, completeEcsSimplifiedObject.targetGroup, defaultVpc);
              step = 'createTargetGroup';
              // load balancer y lb security group
              await AwsEcsSimplifiedModule.utils.cloud.create.loadBalancer(client, completeEcsSimplifiedObject.loadBalancer, defaultSubnets);
              step = 'createLoadBalancer';
              // listener
              await AwsEcsSimplifiedModule.utils.cloud.create.listener(client, completeEcsSimplifiedObject.listener);
              step = 'createListener';
              // cw log group
              await AwsEcsSimplifiedModule.utils.cloud.create.logGroup(client, completeEcsSimplifiedObject.logGroup);
              step = 'createLogGroup';
              // role
              await AwsEcsSimplifiedModule.utils.cloud.create.role(client, completeEcsSimplifiedObject.role);
              step = 'createRole';
              // cluster
              await AwsEcsSimplifiedModule.utils.cloud.create.cluster(client, completeEcsSimplifiedObject.cluster);
              step = 'createCluster';
              // task with container
              await AwsEcsSimplifiedModule.utils.cloud.create.taskDefinition(client, completeEcsSimplifiedObject.taskDefinition, completeEcsSimplifiedObject.containerDefinition, completeEcsSimplifiedObject.repository);
              step = 'createTaskDefinition';
              // service and serv sg
              await AwsEcsSimplifiedModule.utils.cloud.create.service(client, completeEcsSimplifiedObject.service, completeEcsSimplifiedObject.containerDefinition, defaultSubnets);
              step = 'createService';
              // Update ecs simplified record in database with the new load balancer dns
              e.loadBalancerDns = completeEcsSimplifiedObject.loadBalancer.dnsName;
              // Update ecs simplified record in database with the new ecr repository uri if needed
              if (!!completeEcsSimplifiedObject.repository) {
                e.repositoryUri = completeEcsSimplifiedObject.repository.repositoryUri;
              }
              await AwsEcsSimplifiedModule.mappers.ecsSimplified.db.update(e, ctx);
              out.push(e);
            } catch (err: any) {
              logger.warn(`Error creating ecs simplified resources. Rolling back on step ${step} with error: ${err.message}`);
              // Rollback
              try {
                switch (step) {
                  case 'createService':
                    await AwsEcsSimplifiedModule.utils.cloud.delete.service(client, completeEcsSimplifiedObject.service);
                  case 'createTaskDefinition':
                    await AwsEcsSimplifiedModule.utils.cloud.delete.taskDefinition(client, completeEcsSimplifiedObject.taskDefinition);
                  case 'createCluster':
                    await AwsEcsSimplifiedModule.utils.cloud.delete.cluster(client, completeEcsSimplifiedObject.cluster);
                  case 'createRole':
                    await AwsEcsSimplifiedModule.utils.cloud.delete.role(client, completeEcsSimplifiedObject.role);
                  case 'createLogGroup':
                    await AwsEcsSimplifiedModule.utils.cloud.delete.logGroup(client, completeEcsSimplifiedObject.logGroup);
                  case 'createListener':
                    await AwsEcsSimplifiedModule.utils.cloud.delete.listener(client, completeEcsSimplifiedObject.listener);
                  case 'createLoadBalancer':
                    await AwsEcsSimplifiedModule.utils.cloud.delete.loadBalancer(client, completeEcsSimplifiedObject.loadBalancer);
                  case 'createTargetGroup':
                    await AwsEcsSimplifiedModule.utils.cloud.delete.targetGroup(client, completeEcsSimplifiedObject.targetGroup);
                  case 'createSecurityGroupRules':
                    await AwsEcsSimplifiedModule.utils.cloud.delete.securityGroupRules(client, completeEcsSimplifiedObject.securityGroupRules);
                  case 'createSecurityGroup':
                    await AwsEcsSimplifiedModule.utils.cloud.delete.securityGroup(client, completeEcsSimplifiedObject.securityGroup);
                  default:
                    break;
                }
              } catch (err2: any) {
                // TODO: improve this error message, also this should not happen?
                err.message = `${err.message}. Could not rollback all entities created with error ${err2.message}`;
              }
              // Throw error
              throw err;
            }
          }
          return out;
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          // read all clusters and find the ones that match our pattern
          const clusters = await client.getClusters();
          const relevantClusters = clusters?.filter(c => c.clusterName?.includes(prefix)) ?? [];
          // read all services from relevant clusters
          let relevantServices = [];
          for (const c of relevantClusters) {
            const services = await client.getServices([c.clusterName!]) ?? [];
            relevantServices.push(...services.filter(s => s.serviceName?.includes(prefix)));
          }
          if (ids) {
            relevantServices = relevantServices.filter(s => ids.includes(s.serviceArn!));
          }
          const validServices = [];
          logger.info(`relevant services = ${JSON.stringify(relevantServices)}`);
          for (const s of relevantServices) {
            const isValid = await AwsEcsSimplifiedModule.utils.isValid(s, ctx);
            if (isValid) validServices.push(s);
          }
          logger.info(`valid services = ${JSON.stringify(validServices)}`);
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
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.EcsSimplified?.[e.appName ?? ''];
            const isUpdate = AwsEcsSimplifiedModule.mappers.ecsSimplified.cloud.updateOrReplace(cloudRecord, e) === 'update';
            if (isUpdate) {
              const isServiceUpdate = !(Object.is(e.desiredCount, cloudRecord.desiredCount) &&
                Object.is(e.cpuMem, cloudRecord.cpuMem) &&
                Object.is(e.repositoryUri, cloudRecord.repositoryUri) &&
                Object.is(e.imageTag, cloudRecord.imageTag) &&
                Object.is(e.imageDigest, cloudRecord.imageDigest));
              if (!isServiceUpdate) {
                // Restore values
                await AwsEcsSimplifiedModule.mappers.ecsSimplified.db.update(cloudRecord, ctx);
                out.push(cloudRecord);
                continue;
              }
              const completeEcsSimplifiedObject: EcsSimplifiedObject = AwsEcsSimplifiedModule.utils.getEcsSimplifiedObject(e);
              // Desired count or task definition and container changes
              const updateServiceInput: any = {
                service: completeEcsSimplifiedObject.service.name,
                cluster: completeEcsSimplifiedObject.cluster.clusterName,
                desiredCount: completeEcsSimplifiedObject.service.desiredCount,
              };
              // Create new ecr if needed
              if (!Object.is(e.repositoryUri, cloudRecord.repositoryUri) && !e.repositoryUri) {
                // We first check if a repositroy with the expected name exists.
                try {
                  const repository = await client.getECRRepository(completeEcsSimplifiedObject.repository?.repositoryName ?? '');
                  if (!!repository) {
                    completeEcsSimplifiedObject.repository!.repositoryArn = repository.repositoryArn;
                    completeEcsSimplifiedObject.repository!.repositoryUri = repository.repositoryUri;
                  }
                } catch (_) {
                  // If the repository does not exists we create it
                  await AwsEcsSimplifiedModule.utils.cloud.create.repository(client, completeEcsSimplifiedObject.repository);
                }
              }
              if (!(Object.is(e.cpuMem, cloudRecord.cpuMem) &&
                Object.is(e.repositoryUri, cloudRecord.repositoryUri) &&
                Object.is(e.imageTag, cloudRecord.imageTag) &&
                Object.is(e.imageDigest, cloudRecord.imageDigest))) {
                // Get current task definition from service
                const service = await client.getServiceByName(completeEcsSimplifiedObject.cluster.clusterName, completeEcsSimplifiedObject.service.name);
                const taskDefinition = await client.getTaskDefinition(service?.taskDefinition ?? '');
                completeEcsSimplifiedObject.taskDefinition.taskRole!.arn = taskDefinition?.taskRoleArn;
                completeEcsSimplifiedObject.taskDefinition.executionRole!.arn = taskDefinition?.executionRoleArn;
                // If no new reporsitory, set image
                if (!completeEcsSimplifiedObject.repository) {
                  completeEcsSimplifiedObject.containerDefinition.image = e.repositoryUri;
                }
                const logGroup = await client.getLogGroups(taskDefinition?.containerDefinitions?.[0]?.logConfiguration?.options?.["awslogs-group"]);
                completeEcsSimplifiedObject.logGroup.logGroupArn = logGroup[0].arn;
                // Create new task definition
                const newTaskDefinition = await AwsEcsSimplifiedModule.utils.cloud.create.taskDefinition(client, completeEcsSimplifiedObject.taskDefinition, completeEcsSimplifiedObject.containerDefinition, completeEcsSimplifiedObject.repository);
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
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            const completeEcsSimplifiedObject: EcsSimplifiedObject = AwsEcsSimplifiedModule.utils.getEcsSimplifiedObject(e);
            const service = await client.getServiceByName(completeEcsSimplifiedObject.cluster.clusterName, completeEcsSimplifiedObject.service.name);
            completeEcsSimplifiedObject.cluster.clusterArn = service?.clusterArn;
            completeEcsSimplifiedObject.securityGroup.groupId = service?.networkConfiguration?.awsvpcConfiguration?.securityGroups?.pop();
            completeEcsSimplifiedObject.taskDefinition.taskDefinitionArn = service?.taskDefinition;
            const serviceLoadBalancer = service?.loadBalancers?.pop();
            // Find load balancer
            completeEcsSimplifiedObject.targetGroup.targetGroupArn = serviceLoadBalancer?.targetGroupArn;
            const targetGroup = await client.getTargetGroup(completeEcsSimplifiedObject.targetGroup.targetGroupArn ?? '');
            completeEcsSimplifiedObject.loadBalancer.loadBalancerArn = targetGroup?.LoadBalancerArns?.pop();
            await AwsEcsSimplifiedModule.utils.cloud.delete.service(client, completeEcsSimplifiedObject.service);
            await AwsEcsSimplifiedModule.utils.cloud.delete.taskDefinition(client, completeEcsSimplifiedObject.taskDefinition);
            await AwsEcsSimplifiedModule.utils.cloud.delete.cluster(client, completeEcsSimplifiedObject.cluster);
            await AwsEcsSimplifiedModule.utils.cloud.delete.role(client, completeEcsSimplifiedObject.role);
            await AwsEcsSimplifiedModule.utils.cloud.delete.logGroup(client, completeEcsSimplifiedObject.logGroup);
            await AwsEcsSimplifiedModule.utils.cloud.delete.loadBalancer(client, completeEcsSimplifiedObject.loadBalancer);
            await AwsEcsSimplifiedModule.utils.cloud.delete.targetGroup(client, completeEcsSimplifiedObject.targetGroup);
            await AwsEcsSimplifiedModule.utils.cloud.delete.securityGroup(client, completeEcsSimplifiedObject.securityGroup);
            // Try to delete ECR if any
            if (!!completeEcsSimplifiedObject.repository) {
              try {
                await AwsEcsSimplifiedModule.utils.cloud.delete.repository(client, completeEcsSimplifiedObject.repository);
              } catch (_) {
                // Do nothing, repository could have images
              }
            } else {
              const image = AwsEcsSimplifiedModule.utils.processImageFromString(e.repositoryUri);
              // If pattern match, means that we create it and we should try to delete it
              if (image.ecrRepositoryName && Object.is(image.ecrRepositoryName, `${prefix}${e.appName}-ecr`)) {
                completeEcsSimplifiedObject.repository = AwsEcsSimplifiedModule.utils.simplifiedEntityMapper.repository(prefix, e.appName);
                try {
                  await AwsEcsSimplifiedModule.utils.cloud.delete.repository(client, completeEcsSimplifiedObject.repository);
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
}, __dirname);
