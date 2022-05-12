import { AWS, } from '../../../services/gateways/aws'
import logger, { debugObj } from '../../../services/logger'
import { EcsQuickstart } from './entity'
import { Context, Crud, Mapper, Module, } from '../../interfaces'
import * as metadata from './module.json'
import { SecurityGroup, SecurityGroupRule } from '../aws_security_group/entity'
import { ActionTypeEnum, IpAddressType, Listener, LoadBalancer, LoadBalancerSchemeEnum, LoadBalancerTypeEnum, ProtocolEnum, TargetGroup, TargetTypeEnum } from '../aws_elb/entity'
import { LogGroup } from '../aws_cloudwatch/entity'
import { ImageTagMutability, Repository } from '../aws_ecr/entity'
import { Role } from '../aws_iam/entity'
import { AssignPublicIp, Cluster, ContainerDefinition, CpuMemCombination, Service, TaskDefinition, TransportProtocol } from '../aws_ecs_fargate/entity'
import { Subnet, Vpc } from '@aws-sdk/client-ec2'
import { CreateLoadBalancerCommandInput } from '@aws-sdk/client-elastic-load-balancing-v2'

export type EcsQuickstartObject = {
  securityGroup: SecurityGroup;
  securityGroupRules: SecurityGroupRule[];
  targetGroup: TargetGroup;
  loadBalancer: LoadBalancer;
  listener: Listener;
  logGroup: LogGroup;
  repository?: Repository;
  role?: Role;
  cluster: Cluster;
  taskDefinition: TaskDefinition;
  containerDefinition: ContainerDefinition;
  service: Service;
};
const prefix = 'iasql-ecs-'

export const AwsEcsQuickstartModule: Module = new Module({
  ...metadata,
  utils: {
    ecsQuickstartMapper: (e: any) => {
      const out = new EcsQuickstart();
      // Map entity
      return out;
    },
    // todo: Should add valid method to check if all pieces are in place
    // todo: should we add a default values method to be abdle to compare later?
    getEcsQuickstartObject: (e: EcsQuickstart) => {
      // security groups and security group rules
      const sg = AwsEcsQuickstartModule.utils.getSecurityGroup(e.appName);
      const sgrIngress = AwsEcsQuickstartModule.utils.getSecurityGroupRule(sg, e.appPort, false);
      const sgrEgress = AwsEcsQuickstartModule.utils.getSecurityGroupRule(sg, e.appPort, true);
      // target group
      const tg = AwsEcsQuickstartModule.utils.getTargetGroup(e.appName, e.appPort);
      // load balancer y lb security group
      const lb = AwsEcsQuickstartModule.utils.getLoadBalancer(e.appName, sg);
      // listener
      const lsn = AwsEcsQuickstartModule.utils.getListener(e.appPort, lb, tg);
      // cw log group
      const lg = AwsEcsQuickstartModule.utils.getLogGroup(e.appName);
      // ecr
      const ecr = AwsEcsQuickstartModule.utils.getPrivateEcr(e.appName);
      // role
      const rl = AwsEcsQuickstartModule.utils.getRole(e.appName);
      // cluster
      const cl = AwsEcsQuickstartModule.utils.getCluster(e.appName);
      // task and container
      const td = AwsEcsQuickstartModule.utils.getTaskDefinition(e.appName, rl, e.cpuMem);
      const cd = AwsEcsQuickstartModule.utils.getContainerDefinition(e.appName, e.appPort, e.cpuMem, td, lg);
      // service
      const svc = AwsEcsQuickstartModule.utils.getService(e.appName, e.desiredCount, e.publicIp, cl, td, tg, sg)
      const ecsQuickstart: EcsQuickstartObject = {
        securityGroup: sg,
        securityGroupRules: [sgrIngress, sgrEgress],
        targetGroup: tg,
        loadBalancer: lb,
        listener: lsn,
        logGroup: lg,
        repository: ecr,
        role: rl,
        cluster: cl,
        taskDefinition: td,
        containerDefinition: cd,
        service: svc,
      }
      return ecsQuickstart
    },
    // Entity getters
    getSecurityGroup: (appName: string) => {
      const out = new SecurityGroup();
      out.groupName = `${prefix}${appName}-sg`;
      out.description = `${prefix}${appName} security group`;
      return out;
    },
    getSecurityGroupRule: (sg: SecurityGroup, appPort: number, isEgress: boolean) => {
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
    getTargetGroup: (appName: string, appPort: number) => {
      const out = new TargetGroup();
      out.targetGroupName = `${prefix}${appName}-tg`;
      out.targetType = TargetTypeEnum.IP;
      out.protocol = ProtocolEnum.HTTP;
      out.port = appPort;
      out.healthCheckPath = '/health';
      return out;
    },
    getLoadBalancer: (appName: string, sg: SecurityGroup) => {
      const out = new LoadBalancer();
      out.loadBalancerName = `${prefix}${appName}-lb`;
      out.scheme = LoadBalancerSchemeEnum.INTERNET_FACING;
      out.loadBalancerType = LoadBalancerTypeEnum.APPLICATION;
      out.securityGroups = [sg];
      out.ipAddressType = IpAddressType.IPV4;
      return out;
    },
    getListener: (appPort: number, lb: LoadBalancer, tg: TargetGroup) => {
      const out = new Listener();
      out.loadBalancer = lb;
      out.port = appPort;
      out.protocol = ProtocolEnum.HTTP;
      out.actionType = ActionTypeEnum.FORWARD;
      out.targetGroup = tg;
      return out;
    },
    getLogGroup: (appName: string) => {
      const out = new LogGroup();
      out.logGroupName = `${prefix}${appName}-lg`;
      return out;
    },
    getPrivateEcr: (appName: string) => {
      const out = new Repository();
      out.repositoryName = `${prefix}${appName}-ecr`;  // TODO: what to do if provided?
      out.imageTagMutability = ImageTagMutability.MUTABLE;
      out.scanOnPush = false;
      return out;
    },
    getRole: (appName: string) => {
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
    getCluster: (appName: string) => {
      const out = new Cluster();
      out.clusterName = `${prefix}${appName}-cl`;
      return out;
    },
    getTaskDefinition: (appName: string, rl: Role, cpuMem: string) => {
      const out = new TaskDefinition();
      out.family = `${prefix}${appName}-fm`;
      out.taskRole = rl;
      out.executionRole = rl;
      out.cpuMemory = cpuMem as CpuMemCombination ?? null;
      return out;
    },
    getContainerDefinition: (appName: string, appPort: number, cpuMem: string, td: TaskDefinition, lg: LogGroup) => {
      const out = new ContainerDefinition();
      out.name = `${prefix}${appName}-cn`;
      out.essential = true;
      out.taskDefinition = td;
      out.memoryReservation = +cpuMem.split('-')[1].split('GB')[0] * 1024;
      // out.repository = ecr; // TODO: SHOULD THIS BE DEFINED HERE?
      // out.tag = tag; // TODO: SHOULD THIS BE DEFINED HERE?
      // out.digest = digest; // TODO: SHOULD THIS BE DEFINED HERE?
      out.hostPort = appPort;
      out.containerPort = appPort;
      out.protocol = TransportProtocol.TCP;
      out.logGroup = lg;
      return out;
    },
    getService: (appName: string, desiredCount: number, assignPublicIp: string, cl: Cluster, td: TaskDefinition, tg: TargetGroup, sg: SecurityGroup) => {
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
    // Cloud getters
    getDefaultVpc: async (client: AWS) => {
      // Get default vpc
      const vpcs = (await client.getVpcs()).Vpcs ?? [];
      const defaultVpc = vpcs.find(vpc => vpc.IsDefault);
      return defaultVpc;
    },
    getDefaultSubnets: async (client: AWS, vpcId: string) => {
      // Get subnets
      const subnets = (await client.getSubnetsByVpcId(vpcId)).Subnets ?? [];
      return subnets;
    },
    // Cloud creates
    createSecurityGroup: async (client: AWS, e: SecurityGroup, defaultVpc: Vpc) => {
      const res = await client.createSecurityGroup({
        Description: e.description,
        GroupName: e.groupName,
        VpcId: defaultVpc.VpcId,
      });
      e.groupId = res.GroupId;
      return res;
    },
    createSecurityGroupRules: async (client: AWS, es: SecurityGroupRule[],) => {
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
    createTargetGroup: async (client: AWS, e: TargetGroup, defaultVpc: Vpc) => {
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
    createLoadBalancer: async (client: AWS, e: LoadBalancer, defaultSubnets: Subnet[]) => {
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
      return res;
    },
    createListener: async (client: AWS, e: Listener) => {
      const res = await client.createListener({
        Port: e.port,
        Protocol: e.protocol,
        LoadBalancerArn: e.loadBalancer?.loadBalancerArn,
        DefaultActions: [{ Type: e.actionType, TargetGroupArn: e.targetGroup.targetGroupArn }],
      });
      e.listenerArn = res?.ListenerArn;
      return res;
    },
    createLogGroup: async (client: AWS, e: LogGroup) => {
      return await client.createLogGroup(e.logGroupName);
    },
    createEcr: async (client: AWS, e: Repository) => {
      const res = await client.createECRRepository({
        repositoryName: e.repositoryName,
        imageTagMutability: e.imageTagMutability,
        imageScanningConfiguration: {
          scanOnPush: e.scanOnPush,
        },
      });
      e.repositoryArn = res?.repositoryArn;
      return res;
    },
    createRole: async (client: AWS, e: Role) => {
      const res = await client.newRoleLin(
        e.roleName,
        e.assumeRolePolicyDocument,
        e.attachedPoliciesArns,
        e.description ?? ''
      );
      e.arn = res;
      return res;
    },
    createCluster: async (client: AWS, e: Cluster) => {
      const res = await client.createCluster({
        clusterName: e.clusterName,
      });
      e.clusterArn = res?.clusterArn;
      return res;
    },
    createTaskDefinition: async (client: AWS, td: TaskDefinition, cd: ContainerDefinition, repositoryUri: string, tag: string) => {
      const container: any = { ...cd };
      // TODO: implement this logic properly
      container.image = `${repositoryUri}:${tag}`;
      // let image;
      // if (cd.image) {
      //   image = cd.image;
      // } else if (cd.repository) {
      //   if (!cd.repository?.repositoryUri) {
      //     throw new Error('Repository need to be created first');
      //   }
      //   image = cd.repository.repositoryUri;
      // } else if (cd.publicRepository) {
      //   if (!cd.publicRepository?.repositoryUri) {
      //     throw new Error('Public repository need to be created first');
      //   }
      //   image = cd.publicRepository.repositoryUri;
      // } else {
      //   logger.error('How the DB constraint have been ignored?');
      // }
      // if (cd.digest) {
      //   container.image = `${image}@${cd.digest}`;
      // } else if (cd.tag) {
      //   container.image = `${image}:${cd.tag}`;
      // } else {
      //   container.image = image;
      // }
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
    createService: async (client: AWS, e: Service, cd: ContainerDefinition, defaultSubnets: Subnet[]) => {
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
    // Cloud deletes
    deleteSecurityGroup: async (client: AWS, e: SecurityGroup) => {
      await client.deleteSecurityGroup({
        GroupId: e.groupId,
      });
    },
    deleteSecurityGroupRules: async (client: AWS, es: SecurityGroupRule[]) => {
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
    deleteTargetGroup: async (client: AWS, e: TargetGroup) => {
      await client.deleteTargetGroup(e.targetGroupArn!);
    },
    deleteLoadBalancer: async (client: AWS, e: LoadBalancer) => {
      await client.deleteLoadBalancer(e.loadBalancerArn!);
    },
    deleteListener: async (client: AWS, e: Listener) => {
      await client.deleteListener(e.listenerArn!);
    },
    deleteLogGroup: async (client: AWS, e: LogGroup) => {
      return await client.deleteLogGroup(e.logGroupName);
    },
    deleteEcr: async (client: AWS, e: Repository) => {
      return await client.deleteECRRepository(e.repositoryName);
    },
    deleteRole: async (client: AWS, e: Role) => {
      return await client.deleteRoleLin(e.roleName, e.attachedPoliciesArns);
    },
    deleteCluster: async (client: AWS, e: Cluster) => {
      return await client.deleteCluster(e.clusterName);
    },
    deleteTaskDefinition: async (client: AWS, e: TaskDefinition) => {
      await client.deleteTaskDefinition(e.taskDefinitionArn!);
    },
    deleteService: async (client: AWS, e: Service) => {
      const tasksArns = await client.getTasksArns(e.cluster?.clusterName!, e.name);
      await client.updateService({
        service: e.name,
        cluster: e.cluster?.clusterName,
        desiredCount: 0,
      });
      await client.deleteService(e.name, e.cluster?.clusterArn!, tasksArns);
    },
  },
  mappers: {
    ecsQuickstart: new Mapper<EcsQuickstart>({
      entity: EcsQuickstart,
      equals: (a: EcsQuickstart, b: EcsQuickstart) => true, // todo: implement equals
      entityId: (e: EcsQuickstart) => e.appName ?? '', // todo: is this enough?
      source: 'db',
      cloud: new Crud({
        create: async (es: EcsQuickstart[], ctx: Context) => {
          // todo: create all pieces with defualt values if necessary
          const client = await ctx.getAwsClient() as AWS;
          const defaultVpc = await AwsEcsQuickstartModule.utils.getDefaultVpc(client);
          const defaultSubnets = await AwsEcsQuickstartModule.utils.getDefaultSubnets(client, defaultVpc.VpcId);
          const out = [];
          for (const e of es) {
            let step;
            const completeEcsQuickstartObject: EcsQuickstartObject = AwsEcsQuickstartModule.utils.getEcsQuickstartObject(e);
            try {
              // security groups and security group rules
              const newSg = await AwsEcsQuickstartModule.utils.createSecurityGroup(client, completeEcsQuickstartObject.securityGroup, defaultVpc);
              step = 'createSecurityGroup';
              // completeEcsQuickstartObject.securityGroupRules = completeEcsQuickstartObject.securityGroupRules.map(r => {
              //   r.securityGroup.groupId = newSg.GroupId;
              //   return r;
              // })
              await AwsEcsQuickstartModule.utils.createSecurityGroupRules(client, completeEcsQuickstartObject.securityGroupRules);
              step = 'createSecurityGroupRules';
              // target group
              const newTg = await AwsEcsQuickstartModule.utils.createTargetGroup(client, completeEcsQuickstartObject.targetGroup, defaultVpc);
              step = 'createTargetGroup';
              // load balancer y lb security group
              // completeEcsQuickstartObject.loadBalancer.securityGroups = completeEcsQuickstartObject.loadBalancer.securityGroups?.map(sg => {
              //   sg.groupId = newSg.GroupId;
              //   return sg;
              // });
              const newLb = await AwsEcsQuickstartModule.utils.createLoadBalancer(client, completeEcsQuickstartObject.loadBalancer, defaultSubnets);
              // TODO: should we update the value of the `e` in databse here?
              step = 'createLoadBalancer';
              // listener
              // completeEcsQuickstartObject.listener.loadBalancer.loadBalancerArn = newLb.LoadBalancerArn;
              // completeEcsQuickstartObject.listener.targetGroup.targetGroupArn = newTg.TargetGroupArn;
              await AwsEcsQuickstartModule.utils.createListener(client, completeEcsQuickstartObject.listener);
              step = 'createListener';
              // cw log group
              await AwsEcsQuickstartModule.utils.createLogGroup(client, completeEcsQuickstartObject.logGroup);
              step = 'createLogGroup';
              // TODO: add check later if it really need to be created
              // ecr
              if (completeEcsQuickstartObject.repository) {
                await AwsEcsQuickstartModule.utils.createEcr(client, completeEcsQuickstartObject.repository);
                // TODO: should we update the value of the `e` in databse here?
                // TODO: this probably should be the first to be deleted?
                step = 'createEcr';
              }
              // role
              const newRl = await AwsEcsQuickstartModule.utils.createRole(client, completeEcsQuickstartObject.role);
              step = 'createRole';
              // cluster
              await AwsEcsQuickstartModule.utils.createCluster(client, completeEcsQuickstartObject.cluster);
              step = 'createCluster';
              // task with container
              // completeEcsQuickstartObject.taskDefinition.executionRole!.arn = newRl;
              // completeEcsQuickstartObject.taskDefinition.taskRole!.arn = newRl;
              const newTd = await AwsEcsQuickstartModule.utils.createTaskDefinition(client, completeEcsQuickstartObject.taskDefinition, completeEcsQuickstartObject.containerDefinition, e.repositoryUri, e.imageTag);
              step = 'createTaskDefinition';
              // service and serv sg
              // completeEcsQuickstartObject.service.task!.taskDefinitionArn = newTd.taskDefinitionArn;
              // completeEcsQuickstartObject.service.targetGroup!.targetGroupArn = newTg.TargetGroupArn;
              // completeEcsQuickstartObject.service.securityGroups = completeEcsQuickstartObject.service.securityGroups.map(sg => {
              //   sg.groupId = newSg.GroupId;
              //   return sg;
              // });
              await AwsEcsQuickstartModule.utils.createService(client, completeEcsQuickstartObject.service, completeEcsQuickstartObject.containerDefinition, defaultSubnets);
              step = 'createService';
              out.push(e); // TODO: is this ok? return valid property
            } catch (e: any) {
              logger.error('SOMETHING BAD HAPPENED!!!!');
              debugObj(e)
              // Rollback
              try {
                switch (step) {
                  case 'createService':
                    await AwsEcsQuickstartModule.utils.deleteService(completeEcsQuickstartObject.service);
                  case 'createTaskDefinition':
                    await AwsEcsQuickstartModule.utils.deleteTaskDefinition(completeEcsQuickstartObject.taskDefinition);
                  case 'createCluster':
                    await AwsEcsQuickstartModule.utils.deleteCluster(completeEcsQuickstartObject.cluster);
                  case 'createRole':
                    await AwsEcsQuickstartModule.utils.deleteRole(completeEcsQuickstartObject.role);
                  case 'createEcr':
                    await AwsEcsQuickstartModule.utils.deleteEcr(completeEcsQuickstartObject.repository);
                  case 'createLogGroup':
                    await AwsEcsQuickstartModule.utils.deleteLogGroup(completeEcsQuickstartObject.logGroup);
                  case 'createListener':
                    await AwsEcsQuickstartModule.utils.deleteListener(completeEcsQuickstartObject.listener);
                  case 'createLoadBalancer':
                    await AwsEcsQuickstartModule.utils.deleteLoadBalancer(completeEcsQuickstartObject.loadBalancer);
                  case 'createTargetGroup':
                    await AwsEcsQuickstartModule.utils.deleteTargetGroup(completeEcsQuickstartObject.targetGroup);
                  case 'createSecurityGroupRules':
                    await AwsEcsQuickstartModule.utils.deleteSecurityGroupRules(completeEcsQuickstartObject.securityGroupRules);
                  case 'createSecurityGroup':
                    await AwsEcsQuickstartModule.utils.deleteSecurityGroup(completeEcsQuickstartObject.securityGroup);
                  default:
                    break;
                }
              } catch (_) {
                // TODO: improve this error message, also this should not happen?
                e.message = `${e.message}. Could not rollback all entities created.`;
              }
              // Throw error
              throw e;
            }
            // const result = await client.createECRPubRepository({
            //   repositoryName: e.repositoryName,
            // });
            // // Re-get the inserted record to get all of the relevant records we care about
            // const newObject = await client.getECRPubRepository(result.repositoryName ?? '');
            // // We map this into the same kind of entity as `obj`
            // const newEntity = await AwsEcrModule.utils.publicRepositoryMapper(newObject, ctx);
            // // Save the record back into the database to get the new fields updated
            // await AwsEcrModule.mappers.publicRepository.db.update(newEntity, ctx);
            // out.push(newEntity);
          }
          return out;
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          // todo:
          // read all clusters
          // read all services
          // if any, read all important resources
          // if valid return if not filter
          // const ecrs = Array.isArray(ids) ? await (async () => {
          //   const out = [];
          //   for (const id of ids) {
          //     out.push(await client.getECRPubRepository(id));
          //   }
          //   return out;
          // })() :
          //   (await client.getECRPubRepositories()).Repositories ?? [];
          // return ecrs.map(ecr => AwsEcrModule.utils.publicRepositoryMapper(ecr));
        },
        updateOrReplace: () => 'update', // todo: implement
        update: async (es: EcsQuickstart[], ctx: Context) => {
          // todo: just update if valid. if an inner piece need replacement it should be all a replace?
          // Right now we can only modify AWS-generated fields in the database.
          // This implies that on `update`s we only have to restore the db values with the cloud records.
          // const out = [];
          // for (const e of es) {
          // const cloudRecord = ctx?.memo?.cloud?.EcsQuickstart?.[e.repositoryName ?? ''];
          // await AwsEcrModule.mappers.publicRepository.db.update(cloudRecord, ctx);
          // out.push(cloudRecord);
          // }
          // return out;
          return;
        },
        delete: async (es: EcsQuickstart[], ctx: Context) => {
          // todo: just delete if is a valid resource
          // delete service + cluster?
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            // await client.deleteECRPubRepository(e.repositoryName!);
          }
        },
      }),
    }),
  },
}, __dirname);
