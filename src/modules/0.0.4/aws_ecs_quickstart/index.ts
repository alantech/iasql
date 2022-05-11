import { AWS, } from '../../../services/gateways/aws'
import logger from '../../../services/logger'
import { EcsQuickstart } from './entity'
import { Context, Crud, Mapper, Module, } from '../../interfaces'
import * as metadata from './module.json'
import { SecurityGroup, SecurityGroupRule } from '../aws_security_group/entity'
import { ActionTypeEnum, IpAddressType, Listener, LoadBalancer, LoadBalancerSchemeEnum, LoadBalancerTypeEnum, ProtocolEnum, TargetGroup, TargetTypeEnum } from '../aws_elb/entity'
import { LogGroup } from '../aws_cloudwatch/entity'
import { ImageTagMutability, Repository } from '../aws_ecr/entity'
import { Role } from '../aws_iam/entity'
import { Cluster, ContainerDefinition, CpuMemCombination, TaskDefinition, TransportProtocol } from '../aws_ecs_fargate/entity'

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
      const cd = AwsEcsQuickstartModule.utils.getContainerDefinition(e.appName);
      // service and serv sg
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
      }
      return ecsQuickstart
    },
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
      out.targetGroupName =  `${prefix}${appName}-tg`;
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
  },
  mappers: {
    ecsQuickstart: new Mapper<EcsQuickstart>({
      entity: EcsQuickstart,
      equals: (a: EcsQuickstart, b: EcsQuickstart) => true, // todo: implement equals
      entityId: (e: EcsQuickstart) => e.appName ?? '', // todo: is this enough?
      source: 'db',
      cloud: new Crud({
        create: async (es: EcsQuickstart[], ctx: Context) => {
          // todo: create all pieces with defualt values if necessary.
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            // security groups and security group rules
            // target group
            // load balancer y lb security group
            // listener
            // cw log group
            // ecr
            // role
            // cluster
            // task and container
            // service and serv sg


            
            
            
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
          const out = [];
          for (const e of es) {
            // const cloudRecord = ctx?.memo?.cloud?.EcsQuickstart?.[e.repositoryName ?? ''];
            // await AwsEcrModule.mappers.publicRepository.db.update(cloudRecord, ctx);
            // out.push(cloudRecord);
          }
          return out;
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
