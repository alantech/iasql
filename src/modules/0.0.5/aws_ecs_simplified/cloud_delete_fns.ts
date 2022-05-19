import { AWS } from '../../../services/gateways/aws';
import { LogGroup } from '../aws_cloudwatch/entity';
import { Repository } from '../aws_ecr/entity';
import { Cluster, Service, TaskDefinition } from '../aws_ecs_fargate/entity';
import { Listener, LoadBalancer, TargetGroup } from '../aws_elb/entity';
import { Role } from '../aws_iam/entity';
import { SecurityGroup, SecurityGroupRule } from '../aws_security_group/entity';

const cloudDeleteFns = {
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
};

export default cloudDeleteFns;