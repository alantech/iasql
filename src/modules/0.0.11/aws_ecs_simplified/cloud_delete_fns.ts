import {
  DeleteSecurityGroupRequest,
  EC2,
  RevokeSecurityGroupEgressCommandInput,
  RevokeSecurityGroupIngressCommandInput,
  DescribeNetworkInterfacesCommandInput,
} from '@aws-sdk/client-ec2'
import {
  DescribeLoadBalancersCommandInput,
  ElasticLoadBalancingV2,
} from '@aws-sdk/client-elastic-load-balancing-v2'
import { CloudWatchLogs, } from '@aws-sdk/client-cloudwatch-logs'
import { ECR, } from '@aws-sdk/client-ecr'
import { IAM, } from '@aws-sdk/client-iam'
import {
  DescribeServicesCommandInput,
  ECS,
  Service as AwsService,
  paginateListServices,
  paginateListTasks,
  waitUntilTasksStopped,
} from '@aws-sdk/client-ecs'
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter'

import { AWS, mapLin, crudBuilder2, crudBuilderFormat, } from '../../../services/aws_macros'
import { LogGroup } from '../aws_cloudwatch/entity'
import { Repository } from '../aws_ecr/entity'
import { Cluster, Service, TaskDefinition } from '../aws_ecs_fargate/entity'
import { Listener, LoadBalancer, TargetGroup } from '../aws_elb/entity'
import { Role } from '../aws_iam/entity'
import { SecurityGroup, SecurityGroupRule } from '../aws_security_group/entity'
import logger from '../../../services/logger'

const deleteSecurityGroupEgressRules = async (
  client: EC2,
  rules: RevokeSecurityGroupEgressCommandInput[],
) => mapLin(rules, client.revokeSecurityGroupEgress.bind(client));
const deleteSecurityGroupIngressRules = async (
  client: EC2,
  rules: RevokeSecurityGroupIngressCommandInput[],
) => mapLin(rules, client.revokeSecurityGroupIngress.bind(client));
const deleteTargetGroup = crudBuilder2<ElasticLoadBalancingV2, 'deleteTargetGroup'>(
  'deleteTargetGroup',
  (TargetGroupArn) => ({ TargetGroupArn, }),
);
const deleteListener = crudBuilder2<ElasticLoadBalancingV2, 'deleteListener'>(
  'deleteListener',
  (ListenerArn) => ({ ListenerArn, }),
);
const deleteLogGroup = crudBuilderFormat<CloudWatchLogs, 'deleteLogGroup', undefined>(
  'deleteLogGroup',
  (logGroupName) => ({ logGroupName, }),
  (_lg) => undefined,
);
const deleteECRRepository = crudBuilderFormat<ECR, 'deleteRepository', undefined>(
  'deleteRepository',
  (repositoryName) => ({ repositoryName, }),
  (_res) => undefined,
);
const deleteRole = crudBuilder2<IAM, 'deleteRole'>(
  'deleteRole',
  (RoleName) => ({ RoleName, }),
);
const deleteClusterCore = crudBuilder2<ECS, 'deleteCluster'>(
  'deleteCluster',
  (input) => input,
);
const updateService = crudBuilderFormat<ECS, 'updateService', AwsService | undefined>(
  'updateService',
  (input) => input,
  (res) => res?.service,
);
const deleteTaskDefinition = crudBuilder2<ECS, 'deregisterTaskDefinition'>(
  'deregisterTaskDefinition',
  (taskDefinition) => ({ taskDefinition, }),
);

// TODO: Would it ever be possible to macro this?
async function deleteSecurityGroup(client: EC2, instanceParams: DeleteSecurityGroupRequest) {
  try {
    return await client.deleteSecurityGroup(instanceParams);
  } catch(e: any) {
    if (e.Code === 'DependencyViolation') {
      // Just wait for 5 min on every dependency violation and retry
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
      try {
        return await client.deleteSecurityGroup(instanceParams);
      } catch (e2: any) {
        // If the dependency continues we add the dependency to the error message in order to debug what is happening
        if (e2.Code === 'DependencyViolation') {
          const sgEniInfo = await client.describeNetworkInterfaces({
            Filters: [
              {
                Name: 'group-id',
                Values: [`${instanceParams.GroupId}`]
              }
            ]
          });
          const eniMessage = `Network interfaces associated with security group ${instanceParams.GroupId}: ${JSON.stringify(sgEniInfo.NetworkInterfaces)}`;
          e2.message = `${e2.message} | ${eniMessage}`;
        }
        throw e2;
      }
    }
    throw e;
  }
}
// TODO: Really refactor the client access in this thing later
async function deleteLoadBalancer(client: { elbClient: ElasticLoadBalancingV2, ec2client: EC2, }, arn: string) {
  await client.elbClient.deleteLoadBalancer({ LoadBalancerArn: arn, });
  // We wait it is completely deleted to avoid issues deleting dependent resources.
  const input: DescribeLoadBalancersCommandInput = { LoadBalancerArns: [arn], };
  await createWaiter<ElasticLoadBalancingV2, DescribeLoadBalancersCommandInput>(
    {
      client: client.elbClient,
      // all in seconds
      maxWaitTime: 400,
      minDelay: 1,
      maxDelay: 4,
    },
    input,
    async (cl, cmd) => {
      try {
        await cl.describeLoadBalancers(cmd);
        return { state: WaiterState.RETRY };
      } catch (_) {
        return { state: WaiterState.SUCCESS };
      }
    },
  );
  // Now we need wait the load balancer to be fully deattached from any network interface
  const loadBalancerName = arn.split(':loadbalancer/')?.[1] ?? '';
  const describeEniCommand: DescribeNetworkInterfacesCommandInput = {
    Filters: [
      {
        Name: 'description',
        Values: [`*${loadBalancerName}`]
      }
    ]
  };
  await createWaiter<EC2, DescribeNetworkInterfacesCommandInput>(
    {
      client: client.ec2client,
      // all in seconds
      maxWaitTime: 1200,
      minDelay: 1,
      maxDelay: 4,
    },
    describeEniCommand,
    async (cl, cmd) => {
      try {
        const eni = await cl.describeNetworkInterfaces(cmd);
        if (loadBalancerName && eni.NetworkInterfaces?.length) {
          return { state: WaiterState.RETRY };
        }
        return { state: WaiterState.SUCCESS };
      } catch (e) {
        return { state: WaiterState.RETRY };
      }
    },
  );
}
async function getServices(client: ECS, clusterIds: string[]) {
  const services = [];
  for (const id of clusterIds) {
    const serviceArns: string[] = [];
    const paginator = paginateListServices({
      client,
    }, {
      cluster: id,
      maxResults: 100,
    });
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
            services: batch
          });
          services.push(...(result.services ?? []));
        }
      } else {
        const result = await client.describeServices({
          cluster: id,
          services: serviceArns
        });
        services.push(...(result.services ?? []));
      }
    }
  }
  return services;
}
async function getTasksArns(client: ECS, cluster: string, serviceName?: string) {
  const tasksArns: string[] = [];
  let input: any = {
    cluster
  };
  if (serviceName) {
    input = { ...input, serviceName }
  }
  const paginator = paginateListTasks({
    client,
    pageSize: 25,
  }, input);
  for await (const page of paginator) {
    tasksArns.push(...(page.taskArns ?? []));
  }
  return tasksArns;
}
async function deleteService(client: { ecsClient: ECS, ec2client: EC2, }, name: string, cluster: string, tasksArns: string[]) {
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
    const tasks = await client.ecsClient.describeTasks({tasks: tasksArns, cluster});
    const taskAttachmentIds = tasks.tasks?.map(t => t.attachments?.map(a => a.id)).flat()
    if (taskAttachmentIds?.length) {
      const describeEniCommand: DescribeNetworkInterfacesCommandInput = {
        Filters: [
          {
            Name: 'description',
            Values: taskAttachmentIds?.map(id => `*${id}`)
          }
        ]
      };
      await createWaiter<EC2, DescribeNetworkInterfacesCommandInput>(
        {
          client: client.ec2client,
          // all in seconds
          maxWaitTime: 1200,
          // This operation need bigger delays since it takes time and we do not want to overload AWS API
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
    logger.info('Error getting network interfaces for tasks')
  }
}
async function deleteCluster(client: { ecsClient: ECS, ec2client: EC2, }, id: string) {
  const clusterServices = await getServices(client.ecsClient, [id]);
  if (clusterServices.length) {
    for (const s of clusterServices) {
      if (!s.serviceName) continue;
      const serviceTasksArns = await getTasksArns(client.ecsClient, id, s.serviceName);
      s.desiredCount = 0;
      await updateService(client.ecsClient, {
        service: s.serviceName,
        cluster: id,
        desiredCount: s.desiredCount,
      });
      return deleteService(client, s.serviceName!, id, serviceTasksArns);
    }
  }
  const tasks = await getTasksArns(client.ecsClient, id);
  if (tasks.length) {
    await waitUntilTasksStopped({
      client: client.ecsClient,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    }, {
      cluster: id,
      tasks,
    });
  }
  await deleteClusterCore(client.ecsClient, {
    cluster: id,
  });
}

const cloudDeleteFns = {
  securityGroup: (client: AWS, e: SecurityGroup) => deleteSecurityGroup(client.ec2client, {
    GroupId: e.groupId,
  }),
  securityGroupRules: async (client: AWS, es: SecurityGroupRule[]) => {
    for (const e of es) {
      const GroupId = e?.securityGroup?.groupId;
      if (e.isEgress) {
        await deleteSecurityGroupEgressRules(client.ec2client, [{
          GroupId,
          SecurityGroupRuleIds: [e?.securityGroupRuleId ?? ''],
        }]);
      } else {
        await deleteSecurityGroupIngressRules(client.ec2client, [{
          GroupId,
          SecurityGroupRuleIds: [e?.securityGroupRuleId ?? ''],
        }])
      }
    }
  },
  targetGroup: (client: AWS, e: TargetGroup) => deleteTargetGroup(client.elbClient, e.targetGroupArn!),
  loadBalancer: (client: AWS, e: LoadBalancer) => deleteLoadBalancer(client, e.loadBalancerArn!),
  listener: (client: AWS, e: Listener) => deleteListener(client.elbClient, e.listenerArn!),
  logGroup: (client: AWS, e: LogGroup) => deleteLogGroup(client.cwClient, e.logGroupName),
  repository: (client: AWS, e: Repository) => deleteECRRepository(client.ecrClient, e.repositoryName),
  role: (client: AWS, e: Role) => deleteRole(client.iamClient, e.roleName, e.attachedPoliciesArns ?? []),
  cluster: (client: AWS, e: Cluster) => deleteCluster(client, e.clusterName),
  taskDefinition: (client: AWS, e: TaskDefinition) => deleteTaskDefinition(client.ecsClient, e.taskDefinitionArn!),
  service: async (client: AWS, e: Service) => {
    const tasksArns = await getTasksArns(client.ecsClient, e.cluster?.clusterName!, e.name);
    await updateService(client.ecsClient, {
      service: e.name,
      cluster: e.cluster?.clusterName,
      desiredCount: 0,
    });
    await deleteService(client, e.name, e.cluster?.clusterName!, tasksArns);
  },
};

export default cloudDeleteFns;