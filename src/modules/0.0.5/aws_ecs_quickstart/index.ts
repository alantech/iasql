import { AWS, } from '../../../services/gateways/aws'
import logger, { debugObj } from '../../../services/logger'
import { EcsQuickstart } from './entity'
import { Context, Crud, Mapper, Module, } from '../../interfaces'
import * as metadata from './module.json'
import { SecurityGroup, SecurityGroupRule } from '../../0.0.4/aws_security_group/entity'
import { ActionTypeEnum, IpAddressType, Listener, LoadBalancer, LoadBalancerSchemeEnum, LoadBalancerTypeEnum, ProtocolEnum, TargetGroup, TargetTypeEnum } from '../../0.0.4/aws_elb/entity'
import { LogGroup } from '../../0.0.4/aws_cloudwatch/entity'
import { ImageTagMutability, Repository } from '../../0.0.4/aws_ecr/entity'
import { Role } from '../../0.0.4/aws_iam/entity'
import { AssignPublicIp, Cluster, ContainerDefinition, CpuMemCombination, Service, TaskDefinition, TransportProtocol } from '../../0.0.4/aws_ecs_fargate/entity'
import { Subnet, Vpc } from '@aws-sdk/client-ec2'
import { CreateLoadBalancerCommandInput } from '@aws-sdk/client-elastic-load-balancing-v2'
import { Service as AwsService } from '@aws-sdk/client-ecs'
import { PublicRepository } from '../aws_ecr/entity'

export type EcsQuickstartObject = {
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
const prefix = 'iasql-ecs-'

export const AwsEcsQuickstartModule: Module = new Module({
  ...metadata,
  utils: {
    ecsQuickstartMapper: async (e: AwsService, ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = new EcsQuickstart();
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
      const image = AwsEcsQuickstartModule.utils.processImageFromString(containerDefinition?.image);
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
      // TODO: implement proper ecr validation
      // Get ECR
      // const imageSplit = containerDefinition?.image?.split(':') ?? [];
      // const parts = imageSplit[0]?.split('/');
      // const repositoryName = parts[parts.length - 1] ?? null;
      // if (!Object.is(repositoryName, `${prefix}${appName}-ecr`)) return false;
      // const repository = await client.getECRRepository(repositoryName);
      // TODO: A comparison with default objects is needed?
      return true;
    },
    getEcsQuickstartObject: (e: EcsQuickstart) => {
      // TODO: improve variable naming
      // security groups and security group rules
      const sg = AwsEcsQuickstartModule.utils.defaultEntityMapper.securityGroup(e.appName);
      const sgrIngress = AwsEcsQuickstartModule.utils.defaultEntityMapper.securityGroupRule(sg, e.appPort, false);
      const sgrEgress = AwsEcsQuickstartModule.utils.defaultEntityMapper.securityGroupRule(sg, e.appPort, true);
      // target group
      const tg = AwsEcsQuickstartModule.utils.defaultEntityMapper.targetGroup(e.appName, e.appPort);
      // load balancer y lb security group
      const lb = AwsEcsQuickstartModule.utils.defaultEntityMapper.loadBalancer(e.appName, sg);
      // listener
      const lsn = AwsEcsQuickstartModule.utils.defaultEntityMapper.listener(e.appPort, lb, tg);
      // cw log group
      const lg = AwsEcsQuickstartModule.utils.defaultEntityMapper.logGroup(e.appName);
      // ecr
      let repository;
      if (!e.repositoryUri) {
        repository = AwsEcsQuickstartModule.utils.defaultEntityMapper.repository(e.appName);
      }
      // role
      const rl = AwsEcsQuickstartModule.utils.defaultEntityMapper.role(e.appName);
      // cluster
      const cl = AwsEcsQuickstartModule.utils.defaultEntityMapper.cluster(e.appName);
      // task and container
      const td = AwsEcsQuickstartModule.utils.defaultEntityMapper.taskDefinition(e.appName, rl, e.cpuMem);
      const cd = AwsEcsQuickstartModule.utils.defaultEntityMapper.containerDefinition(e.appName, e.appPort, e.cpuMem, td, lg, e.imageTag, e.imageDigest);
      // service
      const svc = AwsEcsQuickstartModule.utils.defaultEntityMapper.service(e.appName, e.desiredCount, e.publicIp, cl, td, tg, sg)
      const ecsQuickstart: EcsQuickstartObject = {
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
        ecsQuickstart.repository = repository;
      }
      return ecsQuickstart
    },
    // Entity getters
    defaultEntityMapper: {
      securityGroup: (appName: string) => {
        const out = new SecurityGroup();
        out.groupName = `${prefix}${appName}-sg`;
        out.description = `${prefix}${appName} security group`;
        return out;
      },
      securityGroupRule: (sg: SecurityGroup, appPort: number, isEgress: boolean) => {
        const out = new SecurityGroupRule();
        out.securityGroup = sg;
        out.isEgress = isEgress;
        out.ipProtocol = isEgress ? '-1' : 'tcp';
        out.fromPort = isEgress ? -1 : appPort;
        out.toPort = isEgress ? -1 : appPort;
        out.cidrIpv4 = '0.0.0.0/0';
        out.description = sg.groupName;
        return out;
      },
      targetGroup: (appName: string, appPort: number) => {
        const out = new TargetGroup();
        out.targetGroupName = `${prefix}${appName}-tg`;
        out.targetType = TargetTypeEnum.IP;
        out.protocol = ProtocolEnum.HTTP;
        out.port = appPort;
        out.healthCheckPath = '/health';
        return out;
      },
      loadBalancer: (appName: string, sg: SecurityGroup) => {
        const out = new LoadBalancer();
        out.loadBalancerName = `${prefix}${appName}-lb`;
        out.scheme = LoadBalancerSchemeEnum.INTERNET_FACING;
        out.loadBalancerType = LoadBalancerTypeEnum.APPLICATION;
        out.securityGroups = [sg];
        out.ipAddressType = IpAddressType.IPV4;
        return out;
      },
      listener: (appPort: number, lb: LoadBalancer, tg: TargetGroup) => {
        const out = new Listener();
        out.loadBalancer = lb;
        out.port = appPort;
        out.protocol = ProtocolEnum.HTTP;
        out.actionType = ActionTypeEnum.FORWARD;
        out.targetGroup = tg;
        return out;
      },
      logGroup: (appName: string) => {
        const out = new LogGroup();
        out.logGroupName = `${prefix}${appName}-lg`;
        return out;
      },
      repository: (appName: string) => {
        const out = new Repository();
        out.repositoryName = `${prefix}${appName}-ecr`;
        out.imageTagMutability = ImageTagMutability.MUTABLE;
        out.scanOnPush = false;
        return out;
      },
      role: (appName: string) => {
        const out = new Role();
        out.roleName = `${prefix}${appName}-rl`;
        out.assumeRolePolicyDocument = JSON.stringify({
          "Version": "2012-10-17",
          "Statement": [
            {
              "Sid": "",
              "Effect": "Allow",
              "Principal": {
                "Service": "ecs-tasks.amazonaws.com"
              },
              "Action": "sts:AssumeRole"
            }
          ]
        });
        out.attachedPoliciesArns = ['arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'];
        return out;
      },
      cluster: (appName: string) => {
        const out = new Cluster();
        out.clusterName = `${prefix}${appName}-cl`;
        return out;
      },
      taskDefinition: (appName: string, rl: Role, cpuMem: string) => {
        const out = new TaskDefinition();
        out.family = `${prefix}${appName}-td`;
        out.taskRole = rl;
        out.executionRole = rl;
        out.cpuMemory = cpuMem as CpuMemCombination ?? null;
        return out;
      },
      containerDefinition: (appName: string, appPort: number, cpuMem: string, td: TaskDefinition, lg: LogGroup, imageTag?: string, imageDigest?: string) => {
        const out = new ContainerDefinition();
        out.name = `${prefix}${appName}-cd`;
        out.essential = true;
        out.taskDefinition = td;
        out.memoryReservation = +cpuMem.split('-')[1].split('GB')[0] * 1024;
        out.tag = imageTag;
        out.digest = imageDigest;
        out.hostPort = appPort;
        out.containerPort = appPort;
        out.protocol = TransportProtocol.TCP;
        out.logGroup = lg;
        return out;
      },
      service: (appName: string, desiredCount: number, assignPublicIp: string, cl: Cluster, td: TaskDefinition, tg: TargetGroup, sg: SecurityGroup) => {
        const out = new Service();
        out.name = `${prefix}${appName}-svc`;
        out.desiredCount = desiredCount;
        out.task = td;
        out.targetGroup = tg;
        out.assignPublicIp = assignPublicIp ? AssignPublicIp.ENABLED : AssignPublicIp.DISABLED;
        out.securityGroups = [sg];
        out.forceNewDeployment = false;
        out.cluster = cl;
        return out;
      },
    },
    cloud: {
      // Cloud getters
      get: {
        defaultVpc: async (client: AWS) => {
          // Get default vpc
          const vpcs = (await client.getVpcs()).Vpcs ?? [];
          const defaultVpc = vpcs.find(vpc => vpc.IsDefault);
          return defaultVpc;
        },
        defaultSubnets: async (client: AWS, vpcId: string) => {
          // Get subnets
          const subnets = (await client.getSubnetsByVpcId(vpcId)).Subnets ?? [];
          return subnets;
        },
      },
      // Cloud creates
      create: {
        securityGroup: async (client: AWS, e: SecurityGroup, defaultVpc: Vpc) => {
          const res = await client.createSecurityGroup({
            Description: e.description,
            GroupName: e.groupName,
            VpcId: defaultVpc.VpcId,
          });
          e.groupId = res.GroupId;
          return res;
        },
        securityGroupRules: async (client: AWS, es: SecurityGroupRule[],) => {
          const out = [];
          for (const e of es) {
            const GroupId = e?.securityGroup?.groupId;
            const newRule: any = {};
            // The rest of these should be defined if present
            if (e.cidrIpv4) newRule.IpRanges = [{ CidrIp: e.cidrIpv4, }];
            if (e.cidrIpv6) newRule.Ipv6Ranges = [{ CidrIpv6: e.cidrIpv6, }];
            if (e.description) {
              if (e.cidrIpv4) newRule.IpRanges[0].Description = e.description;
              if (e.cidrIpv6) newRule.Ipv6Ranges[0].Description = e.description;
            }
            if (e.fromPort) newRule.FromPort = e.fromPort;
            if (e.ipProtocol) newRule.IpProtocol = e.ipProtocol;
            if (e.prefixListId) newRule.PrefixListIds = [e.prefixListId];
            if (e.toPort) newRule.ToPort = e.toPort;
            let res;
            if (e.isEgress) {
              // By default there is an egress rule, lets delete it and create the new one to be able to identify it with our description
              const securityGroupRules = await (await client.getSecurityGroupRules()).SecurityGroupRules ?? [];
              const securityGroupRule = securityGroupRules.find(sgr => Object.is(sgr.GroupId, e.securityGroup.groupId)
                && Object.is(sgr.CidrIpv4, e.cidrIpv4) && Object.is(sgr.FromPort, e.fromPort) && Object.is(sgr.ToPort, e.toPort));
              await client.deleteSecurityGroupEgressRules([{
                GroupId,
                SecurityGroupRuleIds: [securityGroupRule?.SecurityGroupRuleId ?? ''],
              }]);
              res = (await client.createSecurityGroupEgressRules([{
                GroupId,
                IpPermissions: [newRule],
              }]))[0];
            } else {
              res = (await client.createSecurityGroupIngressRules([{
                GroupId,
                IpPermissions: [newRule],
              }]))[0];
            }
            e.securityGroupRuleId = res.SecurityGroupRules?.[0].SecurityGroupRuleId;
            out.push(res);
          }
          return out;
        },
        targetGroup: async (client: AWS, e: TargetGroup, defaultVpc: Vpc) => {
          const res = await client.createTargetGroup({
            Name: e.targetGroupName,
            TargetType: e.targetType,
            Port: e.port,
            VpcId: defaultVpc.VpcId,
            Protocol: e.protocol,
            ProtocolVersion: e.protocolVersion,
            IpAddressType: e.ipAddressType,
            HealthCheckProtocol: e.healthCheckProtocol,
            HealthCheckPort: e.healthCheckPort,
            HealthCheckPath: e.healthCheckPath,
            HealthCheckEnabled: e.healthCheckEnabled,
            HealthCheckIntervalSeconds: e.healthCheckIntervalSeconds,
            HealthCheckTimeoutSeconds: e.healthCheckTimeoutSeconds,
            HealthyThresholdCount: e.healthyThresholdCount,
            UnhealthyThresholdCount: e.unhealthyThresholdCount,
          });
          e.targetGroupArn = res?.TargetGroupArn;
          return res;
        },
        loadBalancer: async (client: AWS, e: LoadBalancer, defaultSubnets: Subnet[]) => {
          const input: CreateLoadBalancerCommandInput = {
            Name: e.loadBalancerName,
            Subnets: defaultSubnets.map(s => s.SubnetId ?? ''),
            Scheme: e.scheme,
            Type: e.loadBalancerType,
            IpAddressType: e.ipAddressType,
            CustomerOwnedIpv4Pool: e.customerOwnedIpv4Pool,
            SecurityGroups: e.securityGroups?.map(sg => sg.groupId ?? ''),
          };
          const res = await client.createLoadBalancer(input);
          e.loadBalancerArn = res?.LoadBalancerArn;
          e.dnsName = res?.DNSName;
          return res;
        },
        listener: async (client: AWS, e: Listener) => {
          const res = await client.createListener({
            Port: e.port,
            Protocol: e.protocol,
            LoadBalancerArn: e.loadBalancer?.loadBalancerArn,
            DefaultActions: [{ Type: e.actionType, TargetGroupArn: e.targetGroup.targetGroupArn }],
          });
          e.listenerArn = res?.ListenerArn;
          return res;
        },
        logGroup: async (client: AWS, e: LogGroup) => {
          return await client.createLogGroup(e.logGroupName);
        },
        repository: async (client: AWS, e: Repository) => {
          const res = await client.createECRRepository({
            repositoryName: e.repositoryName,
            imageTagMutability: e.imageTagMutability,
            imageScanningConfiguration: {
              scanOnPush: e.scanOnPush,
            },
          });
          e.repositoryArn = res?.repositoryArn;
          e.repositoryUri = res?.repositoryUri;
          return res;
        },
        role: async (client: AWS, e: Role) => {
          const res = await client.newRoleLin(
            e.roleName,
            e.assumeRolePolicyDocument,
            e.attachedPoliciesArns,
            e.description ?? ''
          );
          e.arn = res;
          return res;
        },
        cluster: async (client: AWS, e: Cluster) => {
          const res = await client.createCluster({
            clusterName: e.clusterName,
          });
          e.clusterArn = res?.clusterArn;
          return res;
        },
        taskDefinition: async (client: AWS, td: TaskDefinition, cd: ContainerDefinition, repository?: Repository) => {
          const container: any = { ...cd };
          let imageName;
          if (repository) {
            imageName = repository.repositoryUri;
          } else {
            imageName = cd.image;
          }
          if (cd.tag) {
            container.image = `${imageName}:${cd.tag}`;
          } else if (cd.digest) {
            container.image = `${imageName}@${cd.digest}`;
          } else {
            container.image = imageName;
          }
          if (container.logGroup) {
            container.logConfiguration = {
              logDriver: 'awslogs',
              options: {
                "awslogs-group": container.logGroup.logGroupName,
                "awslogs-region": client.region,
                "awslogs-stream-prefix": `awslogs-${cd.name}`
              }
            };
          }
          if (container.containerPort && container.hostPort && container.protocol) {
            container.portMappings = [{
              containerPort: container.containerPort,
              hostPort: container.hostPort,
              protocol: container.protocol,
            }];
          }
          const input: any = {
            family: td.family,
            containerDefinitions: [container],
            requiresCompatibilities: ['FARGATE',],
            networkMode: 'awsvpc',
            taskRoleArn: td.taskRole?.arn,
            executionRoleArn: td.executionRole?.arn,
          };
          if (td.cpuMemory) {
            const [cpuStr, memoryStr] = td.cpuMemory.split('-');
            const cpu = cpuStr.split('vCPU')[1];
            input.cpu = `${+cpu * 1024}`;
            const memory = memoryStr.split('GB')[0];
            input.memory = `${+memory * 1024}`;
          }
          const res = await client.createTaskDefinition(input);
          td.taskDefinitionArn = res?.taskDefinitionArn;
          return res;
        },
        service: async (client: AWS, e: Service, cd: ContainerDefinition, defaultSubnets: Subnet[]) => {
          const input: any = {
            serviceName: e.name,
            taskDefinition: e.task?.taskDefinitionArn,
            launchType: 'FARGATE',
            cluster: e.cluster?.clusterName,
            schedulingStrategy: 'REPLICA',
            desiredCount: e.desiredCount,
            networkConfiguration: {
              awsvpcConfiguration: {
                subnets: defaultSubnets.map(sn => sn.SubnetId),
                securityGroups: e.securityGroups.map(sg => sg.groupId),
                assignPublicIp: e.assignPublicIp,
              }
            },
            loadBalancers: [{
              targetGroupArn: e.targetGroup?.targetGroupArn,
              containerName: cd.name,
              containerPort: cd.containerPort,
            }],
          };
          const res = await client.createService(input);
          e.arn = res?.serviceArn;
          return res;
        },
      },
      // Cloud deletes
      delete: {
        securityGroup: async (client: AWS, e: SecurityGroup) => {
          await client.deleteSecurityGroup({
            GroupId: e.groupId,
          });
        },
        securityGroupRules: async (client: AWS, es: SecurityGroupRule[]) => {
          for (const e of es) {
            const GroupId = e?.securityGroup?.groupId;
            if (e.isEgress) {
              await client.deleteSecurityGroupEgressRules([{
                GroupId,
                SecurityGroupRuleIds: [e?.securityGroupRuleId ?? ''],
              }]);
            } else {
              await client.deleteSecurityGroupIngressRules([{
                GroupId,
                SecurityGroupRuleIds: [e?.securityGroupRuleId ?? ''],
              }])
            }
          }
        },
        targetGroup: async (client: AWS, e: TargetGroup) => {
          await client.deleteTargetGroup(e.targetGroupArn!);
        },
        loadBalancer: async (client: AWS, e: LoadBalancer) => {
          await client.deleteLoadBalancer(e.loadBalancerArn!);
        },
        listener: async (client: AWS, e: Listener) => {
          await client.deleteListener(e.listenerArn!);
        },
        logGroup: async (client: AWS, e: LogGroup) => {
          await client.deleteLogGroup(e.logGroupName);
        },
        repository: async (client: AWS, e: Repository) => {
          await client.deleteECRRepository(e.repositoryName);
        },
        role: async (client: AWS, e: Role) => {
          await client.deleteRoleLin(e.roleName, e.attachedPoliciesArns);
        },
        cluster: async (client: AWS, e: Cluster) => {
          await client.deleteCluster(e.clusterName);
        },
        taskDefinition: async (client: AWS, e: TaskDefinition) => {
          await client.deleteTaskDefinition(e.taskDefinitionArn!);
        },
        service: async (client: AWS, e: Service) => {
          const tasksArns = await client.getTasksArns(e.cluster?.clusterName!, e.name);
          await client.updateService({
            service: e.name,
            cluster: e.cluster?.clusterName,
            desiredCount: 0,
          });
          await client.deleteService(e.name, e.cluster?.clusterName!, tasksArns);
        },
      },
    },
  },
  mappers: {
    ecsQuickstart: new Mapper<EcsQuickstart>({
      entity: EcsQuickstart,
      equals: (a: EcsQuickstart, b: EcsQuickstart) => Object.is(a.appPort, b.appPort) &&
        Object.is(a.cpuMem, b.cpuMem) &&
        Object.is(a.desiredCount, b.desiredCount) &&
        Object.is(a.repositoryUri, b.repositoryUri) &&
        Object.is(a.imageTag, b.imageTag) &&
        Object.is(a.imageDigest, b.imageDigest) &&
        Object.is(a.loadBalancerDns, b.loadBalancerDns) &&
        Object.is(a.publicIp, b.publicIp),
      entityId: (e: EcsQuickstart) => e.appName ?? '', // todo: is this enough?
      source: 'db',
      cloud: new Crud({
        create: async (es: EcsQuickstart[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const defaultVpc = await AwsEcsQuickstartModule.utils.cloud.get.defaultVpc(client);
          const defaultSubnets = await AwsEcsQuickstartModule.utils.cloud.get.defaultSubnets(client, defaultVpc.VpcId);
          const out: any[] = [];
          for (const e of es) {
            let step;
            const completeEcsQuickstartObject: EcsQuickstartObject = AwsEcsQuickstartModule.utils.getEcsQuickstartObject(e);
            // Container image
            // The next path implies a new repository needs to be created
            if (!!completeEcsQuickstartObject.repository) {
              try {
                await AwsEcsQuickstartModule.utils.cloud.create.repository(client, completeEcsQuickstartObject.repository);
              } catch (err) {
                // Ty to rollback on error
                try {
                  await AwsEcsQuickstartModule.utils.cloud.delete.repository(client, completeEcsQuickstartObject.repository);
                } catch (_) {
                  // Do nothing, repositories could have images
                }
                throw err;
              }
            } else {  // This branch implies a valid repository uri have been provided to be used
              completeEcsQuickstartObject.containerDefinition.image = e.repositoryUri;
            }
            try {
              // security groups and security group rules
              await AwsEcsQuickstartModule.utils.cloud.create.securityGroup(client, completeEcsQuickstartObject.securityGroup, defaultVpc);
              step = 'createSecurityGroup';
              await AwsEcsQuickstartModule.utils.cloud.create.securityGroupRules(client, completeEcsQuickstartObject.securityGroupRules);
              step = 'createSecurityGroupRules';
              // target group
              await AwsEcsQuickstartModule.utils.cloud.create.targetGroup(client, completeEcsQuickstartObject.targetGroup, defaultVpc);
              step = 'createTargetGroup';
              // load balancer y lb security group
              await AwsEcsQuickstartModule.utils.cloud.create.loadBalancer(client, completeEcsQuickstartObject.loadBalancer, defaultSubnets);
              step = 'createLoadBalancer';
              // listener
              await AwsEcsQuickstartModule.utils.cloud.create.listener(client, completeEcsQuickstartObject.listener);
              step = 'createListener';
              // cw log group
              await AwsEcsQuickstartModule.utils.cloud.create.logGroup(client, completeEcsQuickstartObject.logGroup);
              step = 'createLogGroup';
              // role
              await AwsEcsQuickstartModule.utils.cloud.create.role(client, completeEcsQuickstartObject.role);
              step = 'createRole';
              // cluster
              await AwsEcsQuickstartModule.utils.cloud.create.cluster(client, completeEcsQuickstartObject.cluster);
              step = 'createCluster';
              // task with container
              await AwsEcsQuickstartModule.utils.cloud.create.taskDefinition(client, completeEcsQuickstartObject.taskDefinition, completeEcsQuickstartObject.containerDefinition, completeEcsQuickstartObject.repository);
              step = 'createTaskDefinition';
              // service and serv sg
              await AwsEcsQuickstartModule.utils.cloud.create.service(client, completeEcsQuickstartObject.service, completeEcsQuickstartObject.containerDefinition, defaultSubnets);
              step = 'createService';
              // Update ecs quickstart record in database with the new load balancer dns
              e.loadBalancerDns = completeEcsQuickstartObject.loadBalancer.dnsName;
              // Update ecs quickstart record in database with the new ecr repository uri if needed
              if (!!completeEcsQuickstartObject.repository) {
                e.repositoryUri = completeEcsQuickstartObject.repository.repositoryUri;
              }
              await AwsEcsQuickstartModule.mappers.ecsQuickstart.db.update(e, ctx);
              out.push(e);
            } catch (err: any) {
              // Rollback
              try {
                switch (step) {
                  case 'createService':
                    await AwsEcsQuickstartModule.utils.cloud.delete.service(client, completeEcsQuickstartObject.service);
                  case 'createTaskDefinition':
                    await AwsEcsQuickstartModule.utils.cloud.delete.taskDefinition(client, completeEcsQuickstartObject.taskDefinition);
                  case 'createCluster':
                    await AwsEcsQuickstartModule.utils.cloud.delete.cluster(client, completeEcsQuickstartObject.cluster);
                  case 'createRole':
                    await AwsEcsQuickstartModule.utils.cloud.delete.role(client, completeEcsQuickstartObject.role);
                  case 'createLogGroup':
                    await AwsEcsQuickstartModule.utils.cloud.delete.logGroup(client, completeEcsQuickstartObject.logGroup);
                  case 'createListener':
                    await AwsEcsQuickstartModule.utils.cloud.delete.listener(client, completeEcsQuickstartObject.listener);
                  case 'createLoadBalancer':
                    await AwsEcsQuickstartModule.utils.cloud.delete.loadBalancer(client, completeEcsQuickstartObject.loadBalancer);
                  case 'createTargetGroup':
                    await AwsEcsQuickstartModule.utils.cloud.delete.targetGroup(client, completeEcsQuickstartObject.targetGroup);
                  case 'createSecurityGroupRules':
                    await AwsEcsQuickstartModule.utils.cloud.delete.securityGroupRules(client, completeEcsQuickstartObject.securityGroupRules);
                  case 'createSecurityGroup':
                    await AwsEcsQuickstartModule.utils.cloud.delete.securityGroup(client, completeEcsQuickstartObject.securityGroup);
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
            const isValid = await AwsEcsQuickstartModule.utils.isValid(s, ctx);
            if (isValid) validServices.push(s);
          }
          logger.info(`valid services = ${JSON.stringify(validServices)}`);
          const out = [];
          for (const s of validServices) {
            out.push(await AwsEcsQuickstartModule.utils.ecsQuickstartMapper(s, ctx));
          }
          return out;
        },
        updateOrReplace: (prev: EcsQuickstart, next: EcsQuickstart) => {
          if (!(Object.is(prev?.appPort, next?.appPort) && Object.is(prev?.publicIp, next?.publicIp))) {
            return 'replace';
          }
          return 'update';
        },
        update: async (es: EcsQuickstart[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.EcsQuickstart?.[e.appName ?? ''];
            const isUpdate = AwsEcsQuickstartModule.mappers.ecsQuickstart.cloud.updateOrReplace(cloudRecord, e) === 'update';
            if (isUpdate) {
              const isServiceUpdate = !(Object.is(e.desiredCount, cloudRecord.desiredCount) &&
                Object.is(e.cpuMem, cloudRecord.cpuMem) &&
                Object.is(e.repositoryUri, cloudRecord.repositoryUri) &&
                Object.is(e.imageTag, cloudRecord.imageTag) &&
                Object.is(e.imageDigest, cloudRecord.imageDigest));
              if (!isServiceUpdate) {
                // Restore values
                await AwsEcsQuickstartModule.mappers.ecsQuickstart.db.update(cloudRecord, ctx);
                out.push(cloudRecord);
                continue;
              }
              const completeEcsQuickstartObject: EcsQuickstartObject = AwsEcsQuickstartModule.utils.getEcsQuickstartObject(e);
              // Desired count or task definition and container changes
              const updateServiceInput: any = {
                service: completeEcsQuickstartObject.service.name,
                cluster: completeEcsQuickstartObject.cluster.clusterName,
                desiredCount: completeEcsQuickstartObject.service.desiredCount,
              };
              // Create new ecr if needed
              if (!Object.is(e.repositoryUri, cloudRecord.repositoryUri) && !e.repositoryUri) {
                // We first check if a repositroy with the expected name exists.
                try {
                  const repository = await client.getECRRepository(completeEcsQuickstartObject.repository?.repositoryName ?? '');
                  if (!!repository) {
                    completeEcsQuickstartObject.repository!.repositoryArn = repository.repositoryArn;
                    completeEcsQuickstartObject.repository!.repositoryUri = repository.repositoryUri;
                  }
                } catch (_) {
                  // If the repository does not exists we create it
                  await AwsEcsQuickstartModule.utils.cloud.create.repository(client, completeEcsQuickstartObject.repository);
                }
              }
              if (!(Object.is(e.cpuMem, cloudRecord.cpuMem) &&
                Object.is(e.repositoryUri, cloudRecord.repositoryUri) &&
                Object.is(e.imageTag, cloudRecord.imageTag) &&
                Object.is(e.imageDigest, cloudRecord.imageDigest))) {
                // Get current task definition from service
                const service = await client.getServiceByName(completeEcsQuickstartObject.cluster.clusterName, completeEcsQuickstartObject.service.name);
                const taskDefinition = await client.getTaskDefinition(service?.taskDefinition ?? '');
                completeEcsQuickstartObject.taskDefinition.taskRole!.arn = taskDefinition?.taskRoleArn;
                completeEcsQuickstartObject.taskDefinition.executionRole!.arn = taskDefinition?.executionRoleArn;
                // If no new reporsitory, set image
                if (!completeEcsQuickstartObject.repository) {
                  completeEcsQuickstartObject.containerDefinition.image = e.repositoryUri;
                }
                const logGroup = await client.getLogGroups(taskDefinition?.containerDefinitions?.[0]?.logConfiguration?.options?.["awslogs-group"]);
                completeEcsQuickstartObject.logGroup.logGroupArn = logGroup[0].arn;
                // Create new task definition
                const newTaskDefinition = await AwsEcsQuickstartModule.utils.cloud.create.taskDefinition(client, completeEcsQuickstartObject.taskDefinition, completeEcsQuickstartObject.containerDefinition, completeEcsQuickstartObject.repository);
                // Set new task definition ARN to service input object
                updateServiceInput.taskDefinition = newTaskDefinition.taskDefinitionArn ?? '';
              }
              const updatedService = await client.updateService(updateServiceInput);
              const ecsQs = await AwsEcsQuickstartModule.utils.ecsQuickstartMapper(updatedService, ctx);
              await AwsEcsQuickstartModule.mappers.ecsQuickstart.db.update(ecsQs, ctx);
              out.push(ecsQs);
            } else {
              await AwsEcsQuickstartModule.mappers.ecsQuickstart.cloud.delete([cloudRecord], ctx);
              const res = await AwsEcsQuickstartModule.mappers.ecsQuickstart.cloud.create([e], ctx);
              out.push(...res);
            }
          }
          return out;
        },
        delete: async (es: EcsQuickstart[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            const completeEcsQuickstartObject: EcsQuickstartObject = AwsEcsQuickstartModule.utils.getEcsQuickstartObject(e);
            const service = await client.getServiceByName(completeEcsQuickstartObject.cluster.clusterName, completeEcsQuickstartObject.service.name);
            completeEcsQuickstartObject.cluster.clusterArn = service?.clusterArn;
            completeEcsQuickstartObject.securityGroup.groupId = service?.networkConfiguration?.awsvpcConfiguration?.securityGroups?.pop();
            completeEcsQuickstartObject.taskDefinition.taskDefinitionArn = service?.taskDefinition;
            const serviceLoadBalancer = service?.loadBalancers?.pop();
            // Find load balancer
            completeEcsQuickstartObject.targetGroup.targetGroupArn = serviceLoadBalancer?.targetGroupArn;
            const targetGroup = await client.getTargetGroup(completeEcsQuickstartObject.targetGroup.targetGroupArn ?? '');
            completeEcsQuickstartObject.loadBalancer.loadBalancerArn = targetGroup?.LoadBalancerArns?.pop();
            await AwsEcsQuickstartModule.utils.cloud.delete.service(client, completeEcsQuickstartObject.service);
            await AwsEcsQuickstartModule.utils.cloud.delete.taskDefinition(client, completeEcsQuickstartObject.taskDefinition);
            await AwsEcsQuickstartModule.utils.cloud.delete.cluster(client, completeEcsQuickstartObject.cluster);
            await AwsEcsQuickstartModule.utils.cloud.delete.role(client, completeEcsQuickstartObject.role);
            await AwsEcsQuickstartModule.utils.cloud.delete.logGroup(client, completeEcsQuickstartObject.logGroup);
            await AwsEcsQuickstartModule.utils.cloud.delete.loadBalancer(client, completeEcsQuickstartObject.loadBalancer);
            await AwsEcsQuickstartModule.utils.cloud.delete.targetGroup(client, completeEcsQuickstartObject.targetGroup);
            await AwsEcsQuickstartModule.utils.cloud.delete.securityGroup(client, completeEcsQuickstartObject.securityGroup);
            // Try to delete ECR if any
            if (!!completeEcsQuickstartObject.repository) {
              try {
                await AwsEcsQuickstartModule.utils.cloud.delete.repository(client, completeEcsQuickstartObject.repository);
              } catch (_) {
                // Do nothing, repository could have images
              }
            } else {
              const image = AwsEcsQuickstartModule.utils.processImageFromString(e.repositoryUri);
              // If pattern match, means that we create it and we should try to delete it
              if (image.ecrRepositoryName && Object.is(image.ecrRepositoryName, `${prefix}${e.appName}-ecr`)) {
                completeEcsQuickstartObject.repository = AwsEcsQuickstartModule.utils.defaultEntityMapper.repository(e.appName);
                try {
                  await AwsEcsQuickstartModule.utils.cloud.delete.repository(client, completeEcsQuickstartObject.repository);
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
