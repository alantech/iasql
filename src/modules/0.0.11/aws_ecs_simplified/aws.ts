import {
  // DescribeInstanceTypesRequest,
  // TerminateInstancesRequest,
  AuthorizeSecurityGroupEgressCommandInput,
  AuthorizeSecurityGroupIngressCommandInput,
  CreateSecurityGroupRequest,
  CreateSubnetCommandInput,
  CreateVpcCommandInput,
  DeleteSecurityGroupRequest,
  DeleteSubnetCommandInput,
  DeleteVpcCommandInput,
  RevokeSecurityGroupEgressCommandInput,
  RevokeSecurityGroupIngressCommandInput,
  RunInstancesCommandInput,
  paginateDescribeInstances,
  paginateDescribeSecurityGroupRules,
  paginateDescribeSecurityGroups,
  paginateDescribeSubnets,
  paginateDescribeVpcs,
  EC2,
  Tag,
  AllocateAddressCommandInput,
  CreateNatGatewayCommandInput,
  NatGatewayState,
  paginateDescribeNatGateways,
  DescribeInstancesCommandInput,
  DescribeNetworkInterfacesCommandInput,
  DescribeNatGatewaysCommandInput,
  CreateVpcEndpointCommandInput,
  paginateDescribeVpcEndpoints,
  ModifyVpcEndpointCommandInput,
} from '@aws-sdk/client-ec2'
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter'
import {
  CreateRepositoryCommandInput,
  ECR,
  paginateDescribeRepositories,
  SetRepositoryPolicyCommandInput
} from '@aws-sdk/client-ecr'
import {
  CreateListenerCommandInput,
  CreateLoadBalancerCommandInput,
  CreateTargetGroupCommandInput,
  DescribeLoadBalancersCommandInput,
  ElasticLoadBalancingV2,
  ModifyListenerCommandInput,
  ModifyTargetGroupCommandInput,
  paginateDescribeListeners,
  paginateDescribeLoadBalancers,
  paginateDescribeTargetGroups,
  SetIpAddressTypeCommandInput,
  SetSecurityGroupsCommandInput,
  SetSubnetsCommandInput,
  TargetTypeEnum,
} from '@aws-sdk/client-elastic-load-balancing-v2'
import {
  CreateClusterCommandInput,
  CreateServiceCommandInput,
  DescribeServicesCommandInput,
  ECS,
  paginateListClusters,
  paginateListServices,
  paginateListTaskDefinitions,
  paginateListTasks,
  RegisterTaskDefinitionCommandInput,
  UpdateServiceCommandInput,
  waitUntilTasksStopped,
} from '@aws-sdk/client-ecs'

import {
  CreateDBInstanceCommandInput,
  DeleteDBInstanceMessage,
  paginateDescribeDBInstances,
  ModifyDBInstanceCommandInput,
  CreateDBParameterGroupCommandInput,
  paginateDescribeDBParameterGroups,
  paginateDescribeDBParameters,
  Parameter,
  RDS,
  DescribeDBInstancesCommandInput,
} from '@aws-sdk/client-rds'
import {
  CloudWatchLogs,
  paginateDescribeLogGroups,
} from '@aws-sdk/client-cloudwatch-logs'
import {
  CreateRepositoryCommandInput as CreatePubRepositoryCommandInput,
  ECRPUBLIC,
  paginateDescribeRepositories as paginateDescribePubRepositories,
} from '@aws-sdk/client-ecr-public'
import {
  ChangeAction,
  ChangeResourceRecordSetsCommandInput,
  CreateHostedZoneCommandInput,
  ListResourceRecordSetsCommandInput,
  paginateListHostedZones,
  ResourceRecordSet,
  Route53,
} from '@aws-sdk/client-route-53'
import { IAM, paginateListRoles, } from '@aws-sdk/client-iam'
import {
  ACM,
  ImportCertificateCommandInput,
  paginateListCertificates
} from '@aws-sdk/client-acm'
import {
  S3,
} from '@aws-sdk/client-s3'

import logger from '../../../services/logger'

type AWSCreds = {
  accessKeyId: string,
  secretAccessKey: string
}

type AWSConfig = {
  credentials: AWSCreds,
  region: string
}

export class AWS {
  private ec2client: EC2
  private ecrClient: ECR
  private elbClient: ElasticLoadBalancingV2
  private ecsClient: ECS
  private rdsClient: RDS
  private cwClient: CloudWatchLogs
  private ecrPubClient: ECRPUBLIC
  private route53Client: Route53
  private iamClient: IAM;
  private acmClient: ACM
  private s3Client: S3
  public region: string

  constructor(config: AWSConfig) {
    this.region = config.region;
    this.ec2client = new EC2(config);
    this.ecrClient = new ECR(config);
    this.elbClient = new ElasticLoadBalancingV2(config);
    this.ecsClient = new ECS(config);
    this.rdsClient = new RDS(config);
    this.cwClient = new CloudWatchLogs(config);
    this.route53Client = new Route53(config);
    this.iamClient = new IAM(config);
    this.acmClient = new ACM(config);
    // Technically available in multiple regions but with weird constraints, and the default is us-east-1
    this.s3Client = new S3({ ...config, region: 'us-east-1', });
    // Service endpoint only available in 'us-east-1' https://docs.aws.amazon.com/general/latest/gr/ecr-public.html
    this.ecrPubClient = new ECRPUBLIC({credentials: config.credentials, region: 'us-east-1'});
  }

  async newRoleLin(
    name: string,
    assumeRolePolicyDocument: string,
    attachedPolicyArns: string[],
    description?: string
  ): Promise<string> {
    const role = await this.iamClient.createRole({
      RoleName: name,
      AssumeRolePolicyDocument: assumeRolePolicyDocument,
      Description: description,
    });
    for (const arn of attachedPolicyArns) {
      await this.iamClient.attachRolePolicy({PolicyArn: arn, RoleName: name});
    }
    return role.Role?.Arn ?? '';
  }

  async updateRoleDescription(name: string, description?: string) {
    await this.iamClient.updateRole({
      RoleName: name,
      Description: description
    });
  }

  async updateRoleAssumePolicy(name: string, assumeRolePolicyDocument: string) {
    await this.iamClient.updateAssumeRolePolicy({
      RoleName: name,
      PolicyDocument: assumeRolePolicyDocument,
    });
  }

  async getRole(name: string) {
    return (await this.iamClient.getRole({RoleName: name})).Role;
  }

  async getAllRoles() {
    const roles = [];
    const paginator = paginateListRoles({
      client: this.iamClient,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      for (const r of page.Roles ?? []) {
        roles.push(r);
      }
    }
    return roles;
  }

  async getRoleAttachedPoliciesArns(name: string) {
    const rolePolicies = (await this.iamClient.listAttachedRolePolicies({RoleName: name})).AttachedPolicies ?? [];
    return rolePolicies.map(p => p.PolicyArn ?? '');
  }

  async getRoleAttachedPoliciesArnsV2(name: string) {
    const rolePolicies = (await this.iamClient.listAttachedRolePolicies({RoleName: name})).AttachedPolicies ?? [];
    return rolePolicies.length ? rolePolicies.map(p => p.PolicyArn ?? '') : undefined;
  }

  async deleteRoleLin(name: string, policyArns: string[]) {
    for (const arn of policyArns) {
      await this.iamClient.detachRolePolicy({RoleName: name, PolicyArn: arn});
    }
    await this.iamClient.deleteRole({RoleName: name});
  }

  async newInstance(newInstancesInput: RunInstancesCommandInput): Promise<string> {
    const create = await this.ec2client.runInstances(newInstancesInput);
    const instanceIds: string[] | undefined = create.Instances?.map((i) => i?.InstanceId ?? '');
    const input: DescribeInstancesCommandInput = {
      InstanceIds: instanceIds,
    };
    // TODO: should we use the paginator instead?
    await createWaiter<EC2, DescribeInstancesCommandInput>(
      {
        client: this.ec2client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (client, cmd) => {
        try {
          const data = await client.describeInstances(cmd);
          for (const reservation of data?.Reservations ?? []) {
            for (const instance of reservation?.Instances ?? []) {
              if (instance.PublicIpAddress === undefined || instance.State?.Name !== 'running')
                return { state: WaiterState.RETRY };
            }
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          if (e.Code === 'InvalidInstanceID.NotFound')
            return { state: WaiterState.RETRY };
          throw e;
        }
      },
    );
    return instanceIds?.pop() ?? ''
  }

  async startInstance(instanceId: string) {
    await this.ec2client.startInstances({
      InstanceIds: [instanceId],
    });
    const input: DescribeInstancesCommandInput = {
      InstanceIds: [instanceId],
    };
    await createWaiter<EC2, DescribeInstancesCommandInput>(
      {
        client: this.ec2client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (client, cmd) => {
        try {
          const data = await client.describeInstances(cmd);
          for (const reservation of data?.Reservations ?? []) {
            for (const instance of reservation?.Instances ?? []) {
              if (instance.State?.Name !== 'running')
                return { state: WaiterState.RETRY };
            }
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          if (e.Code === 'InvalidInstanceID.NotFound')
            return { state: WaiterState.SUCCESS };
          throw e;
        }
      },
    );
  }

  async stopInstance(instanceId: string, hibernate = false) {
    await this.ec2client.stopInstances({
      InstanceIds: [instanceId],
      Hibernate: hibernate,
    });
    const input: DescribeInstancesCommandInput = {
      InstanceIds: [instanceId],
    };
    await createWaiter<EC2, DescribeInstancesCommandInput>(
      {
        client: this.ec2client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (client, cmd) => {
        try {
          const data = await client.describeInstances(cmd);
          for (const reservation of data?.Reservations ?? []) {
            for (const instance of reservation?.Instances ?? []) {
              if (instance.State?.Name !== 'stopped')
                return { state: WaiterState.RETRY };
            }
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          if (e.Code === 'InvalidInstanceID.NotFound')
            return { state: WaiterState.SUCCESS };
          throw e;
        }
      },
    );
  }

  async updateTags(resourceId: string, tags?: { [key: string] : string }) {
    let tgs: Tag[] = [];
    if (tags) {
      tgs = Object.keys(tags).map(k => {
        return {
          Key: k, Value: tags[k]
        }
      });
    }
    // recreate tags
    await this.ec2client.deleteTags({
      Resources: [resourceId],
    });
    await this.ec2client.createTags({
      Resources: [resourceId],
      Tags: tgs,
    })
  }

  async getInstances() {
    const instances = [];
    const paginator = paginateDescribeInstances({
      client: this.ec2client,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      for (const r of page.Reservations ?? []) {
        instances.push(...(r.Instances ?? []));
      }
    }
    return {
      Instances: instances, // Make it "look like" the regular query again
    };
  }

  async getInstanceUserData(id: string): Promise<string | undefined> {
    const attr = await this.ec2client.describeInstanceAttribute({
      Attribute: "userData",
      InstanceId: id
    });
    return attr.UserData?.Value
  }

  async getInstance(id: string) {
    const reservations = await this.ec2client.describeInstances({ InstanceIds: [id], });
    return (reservations?.Reservations?.map(r => r.Instances?.map(i => i)) ?? []).pop()?.pop();
  }

  async terminateInstance(id: string) {
    const response = await this.ec2client.terminateInstances({ InstanceIds: [id], });
    return (response?.TerminatingInstances ?? []).pop();
  }

  async getInstanceType(instanceType: string) {
    return (await this.ec2client.describeInstanceTypes({
      InstanceTypes: [instanceType,],
    }))?.InstanceTypes?.[0];
  }

  async getSecurityGroups() {
    const securityGroups = [];
    const paginator = paginateDescribeSecurityGroups({
      client: this.ec2client,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      securityGroups.push(...(page.SecurityGroups ?? []));
    }
    return {
      SecurityGroups: securityGroups, // Make it "look like" the regular query again
    };
  }

  async getSecurityGroup(id: string) {
    const group = await this.ec2client.describeSecurityGroups({ GroupIds: [id], });
    return (group?.SecurityGroups ?? [])[0];
  }

  async createSecurityGroup(instanceParams: CreateSecurityGroupRequest) {
    return await this.ec2client.createSecurityGroup(instanceParams);
  }

  async deleteSecurityGroup(instanceParams: DeleteSecurityGroupRequest) {
    try {
      return await this.ec2client.deleteSecurityGroup(instanceParams);
    } catch(e: any) {
      if (e.Code === 'DependencyViolation') {
        // Just wait for 5 min on every dependency violation and retry
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        try {
          return await this.ec2client.deleteSecurityGroup(instanceParams);
        } catch (e2: any) {
          // If the dependency continues we add the dependency to the error message in order to debug what is happening
          if (e2.Code === 'DependencyViolation') {
            const sgEniInfo = await this.ec2client.describeNetworkInterfaces({
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

  async getSecurityGroupRules() {
    const securityGroupRules = [];
    const paginator = paginateDescribeSecurityGroupRules({
      client: this.ec2client,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      securityGroupRules.push(...(page.SecurityGroupRules ?? []));
    }
    return {
      SecurityGroupRules: securityGroupRules, // Make it "look like" the regular query again
    };
  }

  async getSecurityGroupRulesByGroupId(groupId: string) {
    const securityGroupRules = [];
    const paginator = paginateDescribeSecurityGroupRules({
      client: this.ec2client,
      pageSize: 25,
    }, {
      Filters: [
        {
          Name: 'group-id',
          Values: [groupId],
        }
      ]
    });
    for await (const page of paginator) {
      securityGroupRules.push(...(page.SecurityGroupRules ?? []));
    }
    return {
      SecurityGroupRules: securityGroupRules, // Make it "look like" the regular query again
    };
  }

  async getSecurityGroupRule(id: string) {
    const rule = await this.ec2client.describeSecurityGroupRules({ SecurityGroupRuleIds: [id], });
    return (rule?.SecurityGroupRules ?? [])[0];
  }

  async createSecurityGroupEgressRules(is: AuthorizeSecurityGroupEgressCommandInput[]) {
    const reses = [];
    for (const i of is) {
      const res = await this.ec2client.authorizeSecurityGroupEgress(i);
      reses.push(res);
    }
    return reses;
  }

  async createSecurityGroupIngressRules(is: AuthorizeSecurityGroupIngressCommandInput[]) {
    const reses = [];
    for (const i of is) {
      const res = await this.ec2client.authorizeSecurityGroupIngress(i);
      reses.push(res);
    }
    return reses;
  }

  async deleteSecurityGroupEgressRules(is: RevokeSecurityGroupEgressCommandInput[]) {
    const reses = [];
    for (const i of is) {
      const res = await this.ec2client.revokeSecurityGroupEgress(i);
      reses.push(res);
    }
    return reses;
  }

  async deleteSecurityGroupIngressRules(is: RevokeSecurityGroupIngressCommandInput[]) {
    const reses = [];
    for (const i of is) {
      const res = await this.ec2client.revokeSecurityGroupIngress(i);
      reses.push(res);
    }
    return reses;
  }

  async createECRRepository(input: CreateRepositoryCommandInput) {
    const repository = await this.ecrClient.createRepository(input);
    return repository.repository;
  }

  async updateECRRepositoryImageScanningConfiguration(repositoryName: string, scanOnPush: boolean) {
    await this.ecrClient.putImageScanningConfiguration({
      repositoryName,
      imageScanningConfiguration: { scanOnPush }
    });
    return this.getECRRepository(repositoryName);
  }

  async updateECRRepositoryImageTagMutability(repositoryName: string, imageTagMutability: string) {
    await this.ecrClient.putImageTagMutability({
      repositoryName,
      imageTagMutability,
    });
    return this.getECRRepository(repositoryName);
  }

  async getECRRepositories() {
    const repositories = [];
    const paginator = paginateDescribeRepositories({
      client: this.ecrClient,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      repositories.push(...(page.repositories ?? []));
    }
    return {
      Repositories: repositories, // Make it "look like" the regular query again
    };
  }

  async getECRRepository(name: string) {
    const repositories = await this.ecrClient.describeRepositories({
      repositoryNames: [name],
    });
    return (repositories.repositories ?? [])[0];
  }

  async deleteECRRepository(name: string) {
    return await this.ecrClient.deleteRepository({
      repositoryName: name,
    });
  }

  async getECRRepositoryPolicy(repositoryName: string) {
    return await this.ecrClient.getRepositoryPolicy({
      repositoryName,
    });
  }

  async setECRRepositoryPolicy(input: SetRepositoryPolicyCommandInput) {
    return await this.ecrClient.setRepositoryPolicy(input);
  }

  async deleteECRRepositoryPolicy(repositoryName: string) {
    return await this.ecrClient.deleteRepositoryPolicy({
      repositoryName,
    });
  }

  async createListener(input: CreateListenerCommandInput) {
    const create = await this.elbClient.createListener(input);
    return create?.Listeners?.pop() ?? null;
  }

  async updateListener(input: ModifyListenerCommandInput) {
    const update = await this.elbClient.modifyListener(input);
    return update?.Listeners?.pop() ?? null;
  }

  async getListeners(loadBalancerArns: string[]) {
    const listeners = [];
    for (const arn of loadBalancerArns) {
      const paginator = paginateDescribeListeners({
        client: this.elbClient,
        pageSize: 25,
      }, {
        LoadBalancerArn: arn,
      });
      for await (const page of paginator) {
        listeners.push(...(page.Listeners ?? []));
      }
    }
    return {
      Listeners: listeners,
    };
  }

  async getListener(arn: string) {
    const result = await this.elbClient.describeListeners({ ListenerArns: [arn], });
    return result?.Listeners?.[0];
  }

  async deleteListener(arn: string) {
    await this.elbClient.deleteListener({ ListenerArn: arn, });
  }

  async createLoadBalancer(input: CreateLoadBalancerCommandInput) {
    const create = await this.elbClient.createLoadBalancer(input);
    let loadBalancer = create?.LoadBalancers?.pop() ?? null;
    if (!loadBalancer) return loadBalancer;
    const waiterInput: DescribeLoadBalancersCommandInput = {
      LoadBalancerArns: [loadBalancer?.LoadBalancerArn!],
    };
    // TODO: should we use the paginator instead?
    await createWaiter<ElasticLoadBalancingV2, DescribeLoadBalancersCommandInput>(
      {
        client: this.elbClient,
        // all in seconds
        maxWaitTime: 600,
        minDelay: 1,
        maxDelay: 4,
      },
      waiterInput,
      async (client, cmd) => {
        try {
          const data = await client.describeLoadBalancers(cmd);
          for (const lb of data?.LoadBalancers ?? []) {
            if (lb.State?.Code !== 'active')
              return { state: WaiterState.RETRY };
            loadBalancer = lb;
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          return { state: WaiterState.RETRY };
        }
      },
    );
    return loadBalancer;
  }

  async updateLoadBalancerIPAddressType(input: SetIpAddressTypeCommandInput) {
    await this.elbClient.setIpAddressType(input);
    return this.getLoadBalancer(input.LoadBalancerArn!);
  }

  async updateLoadBalancerSubnets(input: SetSubnetsCommandInput) {
    await this.elbClient.setSubnets(input);
    return this.getLoadBalancer(input.LoadBalancerArn!);
  }

  async updateLoadBalancerSecurityGroups(input: SetSecurityGroupsCommandInput) {
    await this.elbClient.setSecurityGroups(input);
    return this.getLoadBalancer(input.LoadBalancerArn!);
  }

  async getLoadBalancers() {
    const loadBalancers = [];
    const paginator = paginateDescribeLoadBalancers({
      client: this.elbClient,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      loadBalancers.push(...(page.LoadBalancers ?? []));
    }
    return {
      LoadBalancers: loadBalancers,
    };
  }

  async getLoadBalancer(arn: string) {
    const result = await this.elbClient.describeLoadBalancers({ LoadBalancerArns: [arn], });
    return result?.LoadBalancers?.[0];
  }

  async deleteLoadBalancer(arn: string) {
    await this.elbClient.deleteLoadBalancer({ LoadBalancerArn: arn, });
    // We wait it is completely deleted to avoid issues deleting dependent resources.
    const input: DescribeLoadBalancersCommandInput = { LoadBalancerArns: [arn], };
    await createWaiter<ElasticLoadBalancingV2, DescribeLoadBalancersCommandInput>(
      {
        client: this.elbClient,
        // all in seconds
        maxWaitTime: 400,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (client, cmd) => {
        try {
          await client.describeLoadBalancers(cmd);
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
        client: this.ec2client,
        // all in seconds
        maxWaitTime: 1200,
        minDelay: 1,
        maxDelay: 4,
      },
      describeEniCommand,
      async (client, cmd) => {
        try {
          const eni = await client.describeNetworkInterfaces(cmd);
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

  async createTargetGroup(input: CreateTargetGroupCommandInput) {
    const create = await this.elbClient.createTargetGroup(input);
    return create?.TargetGroups?.pop() ?? null;
  }

  async updateTargetGroup(input: ModifyTargetGroupCommandInput) {
    const update = await this.elbClient.modifyTargetGroup(input);
    return update?.TargetGroups?.pop() ?? null;
  }

  async getTargetGroups() {
    const targetGroups = [];
    const paginator = paginateDescribeTargetGroups({
      client: this.elbClient,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      targetGroups.push(...(page.TargetGroups ?? []));
    }
    return {
      TargetGroups: targetGroups,
    };
  }

  async getTargetGroup(arn: string) {
    const result = await this.elbClient.describeTargetGroups({ TargetGroupArns: [arn], });
    return result?.TargetGroups?.[0];
  }

  async deleteTargetGroup(arn: string) {
    await this.elbClient.deleteTargetGroup({ TargetGroupArn: arn, });
  }

  async getVpcs() {
    const vpcs = [];
    const paginator = paginateDescribeVpcs({
      client: this.ec2client,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      vpcs.push(...(page.Vpcs ?? []));
    }
    return {
      Vpcs: vpcs,
    };
  }

  async getVpc(id: string) {
    const vpcs = await this.ec2client.describeVpcs({ VpcIds: [id], });
    return vpcs?.Vpcs?.[0];
  }

  async createVpc(input: CreateVpcCommandInput) {
    return await this.ec2client.createVpc(input);
  }

  async deleteVpc(input: DeleteVpcCommandInput) {
    return await this.ec2client.deleteVpc(input);
  }

  async getSubnets() {
    const subnets = [];
    const paginator = paginateDescribeSubnets({
      client: this.ec2client,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      subnets.push(...(page.Subnets ?? []));
    }
    return {
      Subnets: subnets,
    };
  }

  async getSubnetsByVpcId(vpcId: string) {
    const subnets = [];
    const paginator = paginateDescribeSubnets({
      client: this.ec2client,
      pageSize: 25,
    }, {
      Filters: [
        {
          Name: 'vpc-id',
          Values: [vpcId]
        }
      ],
    });
    for await (const page of paginator) {
      subnets.push(...(page.Subnets ?? []));
    }
    return {
      Subnets: subnets,
    };
  }

  async getSubnet(id: string) {
    const subnets = await this.ec2client.describeSubnets({ SubnetIds: [id], });
    return subnets?.Subnets?.[0];
  }

  async createSubnet(input: CreateSubnetCommandInput) {
    return await this.ec2client.createSubnet(input);
  }

  async deleteSubnet(input: DeleteSubnetCommandInput) {
    return await this.ec2client.deleteSubnet(input);
  }

  async createCluster(input: CreateClusterCommandInput) {
    const result = await this.ecsClient.createCluster(input);
    return result.cluster;
  }

  async getClusters() {
    const clusterArns: string[] = [];
    const paginator = paginateListClusters({
      client: this.ecsClient,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      clusterArns.push(...(page.clusterArns ?? []));
    }
    const result = await this.ecsClient.describeClusters({
      clusters: clusterArns
    });
    return result.clusters;
  }

  async getCluster(id: string) {
    const cluster = await this.ecsClient.describeClusters({
      clusters: [id]
    });
    return cluster.clusters?.[0];
  }

  async getTasksArns(cluster: string, serviceName?: string) {
    const tasksArns: string[] = [];
    let input: any = {
      cluster
    };
    if (serviceName) {
      input = { ...input, serviceName }
    }
    const paginator = paginateListTasks({
      client: this.ecsClient,
      pageSize: 25,
    }, input);
    for await (const page of paginator) {
      tasksArns.push(...(page.taskArns ?? []));
    }
    return tasksArns;
  }

  async deleteCluster(id: string) {
    const clusterServices = await this.getServices([id]);
    if (clusterServices.length) {
      await Promise.all(clusterServices.filter(s => !!s.serviceName).map(async s => {
        const serviceTasksArns = await this.getTasksArns(id, s.serviceName);
        s.desiredCount = 0;
        await this.updateService({
          service: s.serviceName,
          cluster: id,
          desiredCount: s.desiredCount,
        });
        return this.deleteService(s.serviceName!, id, serviceTasksArns);
      }));
    }
    const tasks = await this.getTasksArns(id);
    if (tasks.length) {
      await waitUntilTasksStopped({
        client: this.ecsClient,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      }, {
        cluster: id,
        tasks,
      });
    }
    await this.ecsClient.deleteCluster({
      cluster: id,
    });
  }

  async deleteClusterLin(id: string) {
    const clusterServices = await this.getServices([id]);
    if (clusterServices.length) {
      for (const s of clusterServices) {
        if (!s.serviceName) continue;
        const serviceTasksArns = await this.getTasksArns(id, s.serviceName);
        s.desiredCount = 0;
        await this.updateService({
          service: s.serviceName,
          cluster: id,
          desiredCount: s.desiredCount,
        });
        return this.deleteService(s.serviceName!, id, serviceTasksArns);
      }
    }
    const tasks = await this.getTasksArns(id);
    if (tasks.length) {
      await waitUntilTasksStopped({
        client: this.ecsClient,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      }, {
        cluster: id,
        tasks,
      });
    }
    await this.ecsClient.deleteCluster({
      cluster: id,
    });
  }

  async createTaskDefinition(input: RegisterTaskDefinitionCommandInput) {
    const taskDefinition = await this.ecsClient.registerTaskDefinition(input);
    return taskDefinition.taskDefinition;
  }

  async getTaskDefinitions() {
    const taskDefinitions: any[] = [];
    const activeTaskDefinitionArns: string[] = [];
    const activePaginator = paginateListTaskDefinitions({
      client: this.ecsClient,
    }, {
      status: 'ACTIVE',
      maxResults: 100,
    });
    for await (const page of activePaginator) {
      activeTaskDefinitionArns.push(...(page.taskDefinitionArns ?? []));
    }
    // Look for INACTIVE task definitons being used
    const clusters = await this.getClusters() ?? [];
    const services = await this.getServices(clusters.map(c => c.clusterArn!)) ?? [];
    const servicesTasks = services.map(s => s.taskDefinition!) ?? [];
    for (const st of servicesTasks) {
      if (!activeTaskDefinitionArns.includes(st)) {
        taskDefinitions.push(await this.getTaskDefinition(st));
      }
    }
    // Do not run them in parallel to avoid AWS throttling error
    for (const arn of activeTaskDefinitionArns) {
      taskDefinitions.push(await this.getTaskDefinition(arn));
    }
    return {
      taskDefinitions,
    };
  }

  // :id could be `family:revision` or ARN
  async getTaskDefinition(id: string) {
    const taskDefinition = await this.ecsClient.describeTaskDefinition({
      taskDefinition: id
    });
    return taskDefinition.taskDefinition;
  }

  async deleteTaskDefinition(name: string) {
    await this.ecsClient.deregisterTaskDefinition({
      taskDefinition: name
    });
  }

  async createService(input: CreateServiceCommandInput) {
    const result = await this.ecsClient.createService(input);
    return result.service;
  }

  async updateService(input: UpdateServiceCommandInput) {
    const result = await this.ecsClient.updateService(input);
    return result.service;
  }

  async getServices(clusterIds: string[]) {
    const services = [];
    for (const id of clusterIds) {
      const serviceArns: string[] = [];
      const paginator = paginateListServices({
        client: this.ecsClient,
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
            const result = await this.ecsClient.describeServices({
              cluster: id,
              services: batch
            });
            services.push(...(result.services ?? []));
          }
        } else {
          const result = await this.ecsClient.describeServices({
            cluster: id,
            services: serviceArns
          });
          services.push(...(result.services ?? []));
        }
      }
    }
    return services;
  }

  async getService(id: string, cluster: string) {
    const result = await this.ecsClient.describeServices({
      services: [id],
      cluster,
    });
    return result.services?.[0];
  }

  async getServiceByName(cluster: string, name: string) {
    const services = [];
    const serviceArns: string[] = [];
    const paginator = paginateListServices({
      client: this.ecsClient,
    }, {
      cluster,
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
          const result = await this.ecsClient.describeServices({
            cluster,
            services: batch
          });
          services.push(...(result.services ?? []));
        }
      } else {
        const result = await this.ecsClient.describeServices({
          cluster,
          services: serviceArns
        });
        services.push(...(result.services ?? []));
      }
    }
    return services.find(s => Object.is(s.serviceName, name));
  }

  async deleteService(name: string, cluster: string, tasksArns: string[]) {
    await this.ecsClient.deleteService({
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
        client: this.ecsClient,
        // all in seconds
        maxWaitTime: 600,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (client, cmd) => {
        const data = await client.describeServices(cmd);
        if (data.services?.length && data.services[0].status === 'DRAINING') {
          return { state: WaiterState.RETRY };
        } else {
          return { state: WaiterState.SUCCESS };
        }
      },
    );
    try {
      const tasks = await this.ecsClient.describeTasks({tasks: tasksArns, cluster});
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
            client: this.ec2client,
            // all in seconds
            maxWaitTime: 1200,
            // This operation need bigger delays since it takes time and we do not want to overload AWS API
            minDelay: 30,
            maxDelay: 60,
          },
          describeEniCommand,
          async (client, cmd) => {
            try {
              const eni = await client.describeNetworkInterfaces(cmd);
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

  async deleteServiceOnly(name: string, cluster: string) {
    await this.ecsClient.deleteService({
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
        client: this.ecsClient,
        // all in seconds
        maxWaitTime: 600,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (client, cmd) => {
        const data = await client.describeServices(cmd);
        if (data.services?.length && data.services[0].status === 'DRAINING') {
          return { state: WaiterState.RETRY };
        } else {
          return { state: WaiterState.SUCCESS };
        }
      },
    );
  }

  async createDBInstance(instanceParams: CreateDBInstanceCommandInput) {
    let newDBInstance = (await this.rdsClient.createDBInstance(instanceParams)).DBInstance;
    const input: DescribeDBInstancesCommandInput = {
      DBInstanceIdentifier: instanceParams.DBInstanceIdentifier,
    };
    // TODO: should we use the paginator instead?
    await createWaiter<RDS, DescribeDBInstancesCommandInput>(
      {
        client: this.rdsClient,
        // all in seconds
        maxWaitTime: 1200,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (client, cmd) => {
        try {
          const data = await client.describeDBInstances(cmd);
          for (const dbInstance of data?.DBInstances ?? []) {
            if (dbInstance.DBInstanceStatus !== 'available')
              return { state: WaiterState.RETRY };
            newDBInstance = dbInstance;
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          if (e.Code === 'InvalidInstanceID.NotFound')
            return { state: WaiterState.RETRY };
          throw e;
        }
      },
    );
    return newDBInstance;
  }

  async getDBInstance(id: string) {
    const dbInstance = await this.rdsClient.describeDBInstances({ DBInstanceIdentifier: id, });
    return (dbInstance?.DBInstances ?? [])[0];
  }

  async getDBInstances() {
    const dbInstances = [];
    const paginator = paginateDescribeDBInstances({
      client: this.rdsClient,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      dbInstances.push(...(page.DBInstances?.filter(dbInstance => dbInstance.DBInstanceStatus === 'available') ?? []));
    }
    return {
      DBInstances: dbInstances, // Make it "look like" the regular query again
    };
  }

  async deleteDBInstance(deleteInput: DeleteDBInstanceMessage) {
    await this.rdsClient.deleteDBInstance(deleteInput);
    const cmdInput: DescribeDBInstancesCommandInput = {
      DBInstanceIdentifier: deleteInput.DBInstanceIdentifier,
    };
    await createWaiter<RDS, DescribeDBInstancesCommandInput>(
      {
        client: this.rdsClient,
        // all in seconds
        maxWaitTime: 1200,
        minDelay: 1,
        maxDelay: 4,
      },
      cmdInput,
      async (client, input) => {
        const data = await client.describeDBInstances(input);
        for (const dbInstance of data?.DBInstances ?? []) {
          if (dbInstance.DBInstanceStatus === 'deleting')
            return { state: WaiterState.RETRY };
        }
        return { state: WaiterState.SUCCESS };
      },
    );
  }

  async updateDBInstance(input: ModifyDBInstanceCommandInput) {
    let updatedDBInstance = (await this.rdsClient.modifyDBInstance(input))?.DBInstance;
    const inputCommand: DescribeDBInstancesCommandInput = {
      DBInstanceIdentifier: input.DBInstanceIdentifier,
    };
    await createWaiter<RDS, DescribeDBInstancesCommandInput>(
      {
        client: this.rdsClient,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      inputCommand,
      async (client, cmd) => {
        try {
          const data = await client.describeDBInstances(cmd);
          if (!data || !data.DBInstances?.length) return { state: WaiterState.RETRY };
          for (const dbInstance of data?.DBInstances ?? []) {
            if (dbInstance.DBInstanceStatus === 'available')
              return { state: WaiterState.RETRY };
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          if (e.Code === 'InvalidInstanceID.NotFound')
            return { state: WaiterState.RETRY };
          throw e;
        }
      },
    );
    await createWaiter<RDS, DescribeDBInstancesCommandInput>(
      {
        client: this.rdsClient,
        // all in seconds
        maxWaitTime: 1200,
        minDelay: 1,
        maxDelay: 4,
      },
      inputCommand,
      async (client, cmd) => {
        try {
          const data = await client.describeDBInstances(cmd);
          if (!data || !data.DBInstances?.length) return { state: WaiterState.RETRY };
          for (const dbInstance of data?.DBInstances ?? []) {
            if (dbInstance.DBInstanceStatus !== 'available')
              return { state: WaiterState.RETRY };
            updatedDBInstance = dbInstance;
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          if (e.Code === 'InvalidInstanceID.NotFound')
            return { state: WaiterState.RETRY };
          throw e;
        }
      },
    );
    return updatedDBInstance;
  }

  async createLogGroup(groupName: string) {
    await this.cwClient.createLogGroup({
      logGroupName: groupName,
    });
  }

  async getLogGroups(groupName?: string) {
    const logGroups = [];
    const paginator = paginateDescribeLogGroups({
      client: this.cwClient,
      pageSize: 25,
    }, {
      logGroupNamePrefix: groupName,
    });
    for await (const page of paginator) {
      logGroups.push(...(page.logGroups ?? []));
    }
    return logGroups;
  }

  async deleteLogGroup(groupName: string) {
    await this.cwClient.deleteLogGroup({
      logGroupName: groupName,
    });
  }

  async createECRPubRepository(input: CreatePubRepositoryCommandInput) {
    const repository = await this.ecrPubClient.createRepository(input);
    return repository.repository;
  }

  async getECRPubRepositories() {
    const repositories = [];
    const paginator = paginateDescribePubRepositories({
      client: this.ecrPubClient,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      repositories.push(...(page.repositories ?? []));
    }
    return {
      Repositories: repositories, // Make it "look like" the regular query again
    };
  }

  async getECRPubRepository(name: string) {
    const repositories = await this.ecrPubClient.describeRepositories({
      repositoryNames: [name],
    });
    return (repositories.repositories ?? [])[0];
  }

  async deleteECRPubRepository(name: string) {
    return await this.ecrPubClient.deleteRepository({
      repositoryName: name,
    });
  }

  async createHostedZone(domainName: string) {
    const input: CreateHostedZoneCommandInput = {
      Name: domainName,
      CallerReference: `${this.region}-${Date.now()}`,
    }
    const res = await this.route53Client.createHostedZone(input);
    return res.HostedZone;
  }

  async getHostedZones() {
    const hostedZones = [];
    const paginator = paginateListHostedZones({
      client: this.route53Client,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      hostedZones.push(...(page.HostedZones ?? []));
    }
    return hostedZones;
  }

  async getHostedZone(hostedZoneId: string) {
    const res = await this.route53Client.getHostedZone({
      Id: hostedZoneId,
    });
    return res.HostedZone;
  }

  async deleteHostedZone(hostedZoneId: string) {
    const res = await this.route53Client.deleteHostedZone({
      Id: hostedZoneId,
    });
    return res.ChangeInfo;
  }

  newChangeResourceRecordSetsCommand(hostedZoneId: string, record: ResourceRecordSet, action: ChangeAction): ChangeResourceRecordSetsCommandInput {
    return {
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Changes: [{
          Action: action,
          ResourceRecordSet: record
        }]
      }
    }
  }

  async createResourceRecordSet(hostedZoneId: string, record: ResourceRecordSet) {
    const res = await this.route53Client.changeResourceRecordSets(
      this.newChangeResourceRecordSetsCommand(hostedZoneId, record, 'CREATE')
    );
    return res;
  }

  async getRecords(hostedZoneId: string) {
    const records = [];
    let res;
    do {
      const input: ListResourceRecordSetsCommandInput = {
        HostedZoneId: hostedZoneId,
      };
      if (res?.NextRecordName) {
        input.StartRecordName = res.NextRecordName;
      }
      res = await this.route53Client.listResourceRecordSets(input);
      records.push(...(res.ResourceRecordSets ?? []));
    } while (res?.IsTruncated);
    return records;
  }

  async getRecord(hostedZoneId: string, recordName: string, recordType: string) {
    const records = await this.getRecords(hostedZoneId);
    return records.find(r => Object.is(r.Type, recordType) && Object.is(r.Name, recordName));
  }

  async deleteResourceRecordSet(hostedZoneId: string, record: ResourceRecordSet) {
    const res = await this.route53Client.changeResourceRecordSets(
      this.newChangeResourceRecordSetsCommand(hostedZoneId, record, 'DELETE')
    );
    return res;
  }

  async getCertificatesSummary() {
    const certificatesSummary = [];
    const paginator = paginateListCertificates({
      client: this.acmClient,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      certificatesSummary.push(...(page.CertificateSummaryList ?? []));
    }
    return certificatesSummary;
  }

  async getCertificates() {
    const certificates = [];
    const certificatesSummary = await this.getCertificatesSummary();
    for (const certificate of certificatesSummary) {
      const c = await this.acmClient.describeCertificate({ CertificateArn: certificate.CertificateArn });
      certificates.push(c.Certificate);
    }
    return certificates;
  }

  async getCertificate(arn: string) {
    const res = await this.acmClient.describeCertificate({ CertificateArn: arn });
    return res.Certificate;
  }

  async deleteCertificate(arn: string) {
    await this.acmClient.deleteCertificate({ CertificateArn: arn });
    let certificates: string[] = [];
    let i = 0;
     // Wait for ~1min until imported cert is available
    do {
      await new Promise(r => setTimeout(r, 2000)); // Sleep for 2s
      certificates = (await this.getCertificatesSummary())?.map(c => c.CertificateArn ?? '') ?? [];
      i++;
    } while (!certificates.includes(arn) && i < 30);
  }

  async importCertificate(input: ImportCertificateCommandInput) {
    const res = await this.acmClient.importCertificate(input);
    const arn = res.CertificateArn ?? '';
    let certificates: string[] = [];
    let i = 0;
     // Wait for ~1min until imported cert is available
    do {
      await new Promise(r => setTimeout(r, 2000)); // Sleep for 2s
      certificates = (await this.getCertificatesSummary())?.map(c => c.CertificateArn ?? '') ?? [];
      i++;
    } while (!certificates.includes(arn) && i < 30);
    return arn;
  }

  async getBuckets() {
    const res = await this.s3Client.listBuckets({});
    return res.Buckets ?? [];
  }

  async createBucket(name: string) {
    return this.s3Client.createBucket({
      Bucket: name, // Even the little things are inconsistent with the AWS API
    });
  }

  async deleteBucket(name: string) {
    return this.s3Client.deleteBucket({
      Bucket: name,
    });
  }

  async getRegisteredInstance(instanceId: string, targetGroupArn: string, port?: string) {
    const target: any = {
      Id: instanceId,
    };
    if (port) {
      target.Port = +port;
    }
    const res = await this.elbClient.describeTargetHealth({
      TargetGroupArn: targetGroupArn,
      Targets: [target]
    });
    const out = [...(res.TargetHealthDescriptions?.map(thd => (
      {
        targetGroupArn,
        instanceId: thd.Target?.Id,
        port: thd.Target?.Port,
      }
    )) ?? [])];
    return out.pop();
  }

  async getRegisteredInstances() {
    const targetGroups = await this.getTargetGroups();
    const instanceTargetGroups = targetGroups?.TargetGroups?.filter(tg => Object.is(tg.TargetType, TargetTypeEnum.INSTANCE)) ?? [];
    const out = [];
    for (const tg of instanceTargetGroups) {
      const res = await this.elbClient.describeTargetHealth({
        TargetGroupArn: tg.TargetGroupArn,
      });
      out.push(...(res.TargetHealthDescriptions?.map(thd => (
        {
          targetGroupArn: tg.TargetGroupArn,
          instanceId: thd.Target?.Id,
          port: thd.Target?.Port,
        }
      )) ?? []));
    }
    return out;
  }

  async registerInstance(instanceId: string, targetGroupArn: string, port?: number) {
    const target: any = {
      Id: instanceId,
    };
    if (port) {
      target.Port = port;
    }
    await this.elbClient.registerTargets({
      TargetGroupArn: targetGroupArn,
      Targets: [target],
    });
  }

  async deregisterInstance(instanceId: string, targetGroupArn: string, port?: number) {
    const target: any = {
      Id: instanceId,
    };
    if (port) {
      target.Port = port;
    }
    await this.elbClient.deregisterTargets({
      TargetGroupArn: targetGroupArn,
      Targets: [target],
    });
  }

  async createNatGateway(input: CreateNatGatewayCommandInput) {
    let out;
    const res = await this.ec2client.createNatGateway(input);
    out = res.NatGateway;
    const describeInput: DescribeNatGatewaysCommandInput = {
      NatGatewayIds: [res.NatGateway?.NatGatewayId ?? '']
    };
    await createWaiter<EC2, DescribeNatGatewaysCommandInput>(
      {
        client: this.ec2client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      describeInput,
      async (client, cmd) => {
        const data = await client.describeNatGateways(cmd);
        try {
          out = data.NatGateways?.pop();
          // If it is not a final state we retry
          if ([NatGatewayState.DELETING, NatGatewayState.PENDING].includes(out?.State as NatGatewayState)) {
            return { state: WaiterState.RETRY };
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          throw e;
        }
      },
    );
    return out;
  }

  async getNatGateway(id: string) {
    const res = await this.ec2client.describeNatGateways({
      NatGatewayIds: [id],
      Filter: [
        {
          Name: 'state',
          Values: [NatGatewayState.AVAILABLE, NatGatewayState.FAILED]
        }
      ]
    });
    return res.NatGateways?.pop();
  }

  async getNatGateways() {
    const natGateways = [];
    const paginator = paginateDescribeNatGateways({
      client: this.ec2client,
      pageSize: 25,
    }, {
      Filter: [
        {
          Name: 'state',
          Values: [NatGatewayState.AVAILABLE, NatGatewayState.FAILED]
        }
      ]
    });
    for await (const page of paginator) {
      natGateways.push(...(page.NatGateways ?? []));
    }
    return natGateways;
  }

  async deleteNatGateway(id: string) {
    await this.ec2client.deleteNatGateway({
      NatGatewayId: id,
    });
    const describeInput: DescribeNatGatewaysCommandInput = {
      NatGatewayIds: [id ?? '']
    };
    await createWaiter<EC2, DescribeNatGatewaysCommandInput>(
      {
        client: this.ec2client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      describeInput,
      async (client, cmd) => {
        const data = await client.describeNatGateways(cmd);
        try {
          const nat = data.NatGateways?.pop();
          // If it is not a final state we retry
          if ([NatGatewayState.DELETING, NatGatewayState.PENDING].includes(nat?.State as NatGatewayState)) {
            return { state: WaiterState.RETRY };
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          throw e;
        }
      },
    );
  }

  async createDBParameterGroup(input: CreateDBParameterGroupCommandInput) {
    const res = await this.rdsClient.createDBParameterGroup(input);
    return res.DBParameterGroup;
  }

  async getDBParameterGroup(name: string) {
    const res = await this.rdsClient.describeDBParameterGroups({
      DBParameterGroupName: name
    });
    const parameters = await this.getDBParameterGroupParameters(name);
    return { ...res.DBParameterGroups?.pop(), Parameters: parameters };
  }

  async getDBParameterGroups() {
    const out = [];
    const paginator = paginateDescribeDBParameterGroups({
      client: this.rdsClient,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      for (const pg of page.DBParameterGroups ?? []) {
        const parameters = await this.getDBParameterGroupParameters(pg.DBParameterGroupName ?? '');
        out.push({...pg, Parameters: parameters });
      }
    }
    return out;
  }

  async deleteDBParameterGroup(name: string) {
    return this.rdsClient.deleteDBParameterGroup({
      DBParameterGroupName: name
    });
  }

  async getDBParameterGroupParameters(parameterGroupName: string) {
    const out = [];
    const paginator = paginateDescribeDBParameters({
      client: this.rdsClient,
      pageSize: 25,
    }, {
      DBParameterGroupName: parameterGroupName,
    });
    for await (const page of paginator) {
      out.push(...(page.Parameters ?? []));
    }
    return out.map(o => ({ ...o, DBParameterGroupName: parameterGroupName, }));
  }

  async modifyParameter(parameterGroupName: string, parameter: Parameter) {
    await this.rdsClient.modifyDBParameterGroup({
      DBParameterGroupName: parameterGroupName,
      Parameters: [parameter],
    });
  }

  async createElasticIp(tags?: { [key: string] : string }) {
    const allocateAddressCommandInput: AllocateAddressCommandInput = {
      Domain: 'vpc',
    };
    if (tags) {
      let tgs: Tag[] = [];
      tgs = Object.keys(tags).map(k => {
        return {
          Key: k, Value: tags[k]
        }
      });
      allocateAddressCommandInput.TagSpecifications = [
        {
          ResourceType: 'elastic-ip',
          Tags: tgs,
        },
      ];
    }
    return await this.ec2client.allocateAddress(allocateAddressCommandInput);
  }

  async getElasticIp(allocationId: string) {
    const res = await this.ec2client.describeAddresses({
      AllocationIds: [allocationId],
    });
    return res.Addresses?.pop();
  }

  async getElasticIps() {
    const out = [];
    const res = await this.ec2client.describeAddresses({});
    out.push(...(res.Addresses?.filter(a => !!a.AllocationId) ?? []));
    return out;
  }

  async deleteElasticIp(allocationId: string) {
    await this.ec2client.releaseAddress({
      AllocationId: allocationId,
    });
  }

  async createVpcEndpointGateway(input: CreateVpcEndpointCommandInput) {
    const res = await this.ec2client.createVpcEndpoint(input);
    return res.VpcEndpoint;
  }

  async getVpcEndpointGateway(endpointId: string) {
    const res = await this.ec2client.describeVpcEndpoints({
      VpcEndpointIds: [endpointId],
    });
    return res.VpcEndpoints?.pop();
  }

  async getVpcEndpointGateways() {
    const vpcEndpoints = [];
    const paginator = paginateDescribeVpcEndpoints({
      client: this.ec2client,
      pageSize: 25,
    }, {
      Filters: [
        {
          Name: 'vpc-endpoint-type',
          Values: ['Gateway']
        },
        // vpc-endpoint-state - The state of the endpoint:
        // pendingAcceptance | pending | available | deleting | deleted | rejected | failed
        {
          Name: 'vpc-endpoint-state',
          Values: ['available', 'rejected', 'failed']
        }
      ]
    });
    for await (const page of paginator) {
      vpcEndpoints.push(...(page.VpcEndpoints ?? []));
    }
    return vpcEndpoints;
  }

  async deleteVpcEndpointGateway(endpointId: string) {
    const res = await this.ec2client.deleteVpcEndpoints({
      VpcEndpointIds: [endpointId],
    });
    return res.Unsuccessful;
  }

  async modifyVpcEndpointGateway(input: ModifyVpcEndpointCommandInput) {
    const res = await this.ec2client.modifyVpcEndpoint(input);
    return res.Return;
  }

  async getVpcEndpointGatewayServiceName(service: string) {
    const res = await this.ec2client.describeVpcEndpointServices({
      Filters: [
        {
          Name: 'service-type',
          Values: ['Gateway']
        }
      ]
    });
    return res.ServiceNames?.find(sn => sn.includes(service));
  }

  async getVpcRouteTables(vpcId: string) {
    const res = await this.ec2client.describeRouteTables({
      Filters: [
        {
          Name: 'vpc-id',
          Values: [vpcId]
        }
      ]
    });
    return res.RouteTables;
  }
}
