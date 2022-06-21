import { Subnet as AwsSubnet, Vpc as AwsVpc } from '@aws-sdk/client-ec2'
import { CreateLoadBalancerCommandInput } from '@aws-sdk/client-elastic-load-balancing-v2';

import { AWS } from '../../../services/gateways/aws_2';
import { LogGroup } from '../aws_cloudwatch/entity';
import { Repository } from '../aws_ecr/entity';
import { Cluster, ContainerDefinition, Service, TaskDefinition } from '../aws_ecs_fargate/entity';
import { Listener, LoadBalancer, TargetGroup } from '../aws_elb/entity';
import { Role } from '../aws_iam/entity';
import { SecurityGroup, SecurityGroupRule } from '../aws_security_group/entity';

const cloudCreateFns = {
  securityGroup: async (client: AWS, e: SecurityGroup, defaultVpc: AwsVpc) => {
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
  targetGroup: async (client: AWS, e: TargetGroup, defaultVpc: AwsVpc) => {
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
  loadBalancer: async (client: AWS, e: LoadBalancer, defaultSubnets: AwsSubnet[]) => {
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
  logGroup: (client: AWS, e: LogGroup) => client.createLogGroup(e.logGroupName),
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
    const imageName = !!repository ? repository.repositoryUri : cd.image;
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
  service: async (client: AWS, e: Service, cd: ContainerDefinition, defaultSubnets: AwsSubnet[]) => {
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
};

export default cloudCreateFns;