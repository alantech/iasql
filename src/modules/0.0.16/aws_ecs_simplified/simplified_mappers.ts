import { LogGroup } from '../aws_cloudwatch/entity';
import { ImageTagMutability, Repository } from '../aws_ecr/entity';
import {
  AssignPublicIp,
  Cluster,
  ContainerDefinition,
  CpuMemCombination,
  Service,
  TaskDefinition,
  TransportProtocol,
} from '../aws_ecs_fargate/entity';
import {
  ActionTypeEnum,
  IpAddressType,
  Listener,
  LoadBalancer,
  LoadBalancerSchemeEnum,
  LoadBalancerTypeEnum,
  ProtocolEnum,
  TargetGroup,
  TargetTypeEnum,
} from '../aws_elb/entity';
import { Role } from '../aws_iam/entity';
import { SecurityGroup, SecurityGroupRule } from '../aws_security_group/entity';
import { generateResourceName } from './helpers';

const simplifiedMappers = {
  securityGroup: (prefix: string, appName: string) => {
    const out = new SecurityGroup();
    out.groupName = generateResourceName(prefix, appName, 'SecurityGroup');
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
  targetGroup: (prefix: string, appName: string, appPort: number) => {
    const out = new TargetGroup();
    out.targetGroupName = generateResourceName(prefix, appName, 'TargetGroup');
    out.targetType = TargetTypeEnum.IP;
    out.protocol = ProtocolEnum.HTTP;
    out.port = appPort;
    out.healthCheckPath = '/health';
    return out;
  },
  loadBalancer: (prefix: string, appName: string, sg: SecurityGroup) => {
    const out = new LoadBalancer();
    out.loadBalancerName = generateResourceName(prefix, appName, 'LoadBalancer');
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
  logGroup: (prefix: string, appName: string) => {
    const out = new LogGroup();
    out.logGroupName = generateResourceName(prefix, appName, 'LogGroup');
    return out;
  },
  repository: (prefix: string, appName: string) => {
    const out = new Repository();
    out.repositoryName = generateResourceName(prefix, appName, 'Repository');
    out.imageTagMutability = ImageTagMutability.MUTABLE;
    out.scanOnPush = false;
    return out;
  },
  role: (prefix: string, appName: string) => {
    const out = new Role();
    out.roleName = generateResourceName(prefix, appName, 'Role');
    out.assumeRolePolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: '',
          Effect: 'Allow',
          Principal: {
            Service: 'ecs-tasks.amazonaws.com',
          },
          Action: 'sts:AssumeRole',
        },
      ],
    };
    out.attachedPoliciesArns = ['arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'];
    return out;
  },
  cluster: (prefix: string, appName: string) => {
    const out = new Cluster();
    out.clusterName = generateResourceName(prefix, appName, 'Cluster');
    return out;
  },
  taskDefinition: (prefix: string, appName: string, rl: Role, cpuMem: string) => {
    const out = new TaskDefinition();
    out.family = generateResourceName(prefix, appName, 'TaskDefinition');
    out.taskRole = rl;
    out.executionRole = rl;
    out.cpuMemory = (cpuMem as CpuMemCombination) ?? null;
    return out;
  },
  containerDefinition: (
    prefix: string,
    appName: string,
    appPort: number,
    cpuMem: string,
    td: TaskDefinition,
    lg: LogGroup,
    imageTag?: string,
    imageDigest?: string
  ) => {
    const out = new ContainerDefinition();
    out.name = generateResourceName(prefix, appName, 'ContainerDefinition');
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
  service: (
    prefix: string,
    appName: string,
    desiredCount: number,
    assignPublicIp: string,
    cl: Cluster,
    td: TaskDefinition,
    tg: TargetGroup,
    sg: SecurityGroup
  ) => {
    const out = new Service();
    out.name = generateResourceName(prefix, appName, 'Service');
    out.desiredCount = desiredCount;
    out.task = td;
    out.targetGroup = tg;
    out.assignPublicIp = assignPublicIp ? AssignPublicIp.ENABLED : AssignPublicIp.DISABLED;
    out.securityGroups = [sg];
    out.forceNewDeployment = false;
    out.cluster = cl;
    return out;
  },
};

export default simplifiedMappers;
