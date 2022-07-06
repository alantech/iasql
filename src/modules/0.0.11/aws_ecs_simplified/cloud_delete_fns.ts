import { AWS } from './aws';
import { LogGroup } from '../aws_cloudwatch/entity';
import { Repository } from '../aws_ecr/entity';
import { Cluster, Service, TaskDefinition } from '../aws_ecs_fargate/entity';
import { Listener, LoadBalancer, TargetGroup } from '../aws_elb/entity';
import { Role } from '../aws_iam/entity';
import { SecurityGroup, SecurityGroupRule } from '../aws_security_group/entity';

const cloudDeleteFns = {
  securityGroup: (client: AWS, e: SecurityGroup) => client.deleteSecurityGroup({
    GroupId: e.groupId,
  }),
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
  targetGroup: (client: AWS, e: TargetGroup) => client.deleteTargetGroup(e.targetGroupArn!),
  loadBalancer: (client: AWS, e: LoadBalancer) => client.deleteLoadBalancer(e.loadBalancerArn!),
  listener: (client: AWS, e: Listener) => client.deleteListener(e.listenerArn!),
  logGroup: (client: AWS, e: LogGroup) => client.deleteLogGroup(e.logGroupName),
  repository: (client: AWS, e: Repository) => client.deleteECRRepository(e.repositoryName),
  role: (client: AWS, e: Role) => client.deleteRoleLin(e.roleName, e.attachedPoliciesArns ?? []),
  cluster: (client: AWS, e: Cluster) => client.deleteCluster(e.clusterName),
  taskDefinition: (client: AWS, e: TaskDefinition) => client.deleteTaskDefinition(e.taskDefinitionArn!),
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