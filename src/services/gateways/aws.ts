import {
  // DescribeInstanceTypesRequest,
  // TerminateInstancesRequest,
  AuthorizeSecurityGroupEgressCommand,
  AuthorizeSecurityGroupEgressCommandInput,
  AuthorizeSecurityGroupIngressCommand,
  AuthorizeSecurityGroupIngressCommandInput,
  AvailabilityZone,
  CreateSecurityGroupCommand,
  CreateSecurityGroupRequest,
  CreateSubnetCommand,
  CreateSubnetCommandInput,
  CreateVpcCommand,
  CreateVpcCommandInput,
  DeleteSecurityGroupCommand,
  DeleteSecurityGroupRequest,
  DeleteSubnetCommand,
  DeleteSubnetCommandInput,
  DeleteVpcCommand,
  DeleteVpcCommandInput,
  DescribeAvailabilityZonesCommand,
  DescribeImagesCommand,
  DescribeInstanceTypesCommand,
  DescribeInstancesCommand,
  DescribeRegionsCommand,
  DescribeSecurityGroupRulesCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  DescribeVpcsCommand,
  EC2Client,
  ModifySecurityGroupRulesCommand,
  ModifySecurityGroupRulesCommandInput,
  ModifySecurityGroupRulesCommandOutput,
  RevokeSecurityGroupEgressCommand,
  RevokeSecurityGroupEgressCommandInput,
  RevokeSecurityGroupIngressCommand,
  RevokeSecurityGroupIngressCommandInput,
  RunInstancesCommand,
  RunInstancesCommandInput,
  TerminateInstancesCommand,
  paginateDescribeInstanceTypes,
  paginateDescribeInstances,
  paginateDescribeSecurityGroupRules,
  paginateDescribeSecurityGroups,
  paginateDescribeSubnets,
  paginateDescribeVpcs,
  DescribeNetworkInterfacesCommand,
  EC2,
  Tag,
} from '@aws-sdk/client-ec2'
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter'
import {
  CreateRepositoryCommand,
  CreateRepositoryCommandInput,
  DeleteRepositoryCommand,
  DeleteRepositoryPolicyCommand,
  DescribeRepositoriesCommand,
  ECRClient,
  GetRepositoryPolicyCommand,
  paginateDescribeRepositories,
  PutImageScanningConfigurationCommand,
  PutImageTagMutabilityCommand,
  SetRepositoryPolicyCommand,
  SetRepositoryPolicyCommandInput
} from '@aws-sdk/client-ecr'
import {
  CreateListenerCommand,
  CreateListenerCommandInput,
  CreateLoadBalancerCommand,
  CreateLoadBalancerCommandInput,
  CreateTargetGroupCommand,
  CreateTargetGroupCommandInput,
  DeleteListenerCommand,
  DeleteLoadBalancerCommand,
  DeleteTargetGroupCommand,
  DeregisterTargetsCommand,
  DescribeListenersCommand,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  ElasticLoadBalancingV2Client,
  ModifyListenerCommand,
  ModifyListenerCommandInput,
  ModifyTargetGroupCommand,
  ModifyTargetGroupCommandInput,
  paginateDescribeListeners,
  paginateDescribeLoadBalancers,
  paginateDescribeTargetGroups,
  RegisterTargetsCommand,
  SetIpAddressTypeCommand,
  SetIpAddressTypeCommandInput,
  SetSecurityGroupsCommand,
  SetSecurityGroupsCommandInput,
  SetSubnetsCommand,
  SetSubnetsCommandInput,
  TargetTypeEnum,
} from '@aws-sdk/client-elastic-load-balancing-v2'
import {
  CreateClusterCommand,
  CreateClusterCommandInput,
  CreateServiceCommand,
  CreateServiceCommandInput,
  DeleteClusterCommand,
  DeleteServiceCommand,
  DeregisterTaskDefinitionCommand,
  DescribeClustersCommand,
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
  DescribeTasksCommand,
  ECSClient,
  paginateListClusters,
  paginateListServices,
  paginateListTaskDefinitions,
  paginateListTasks,
  RegisterTaskDefinitionCommand,
  RegisterTaskDefinitionCommandInput,
  UpdateServiceCommand,
  UpdateServiceCommandInput,
  waitUntilTasksStopped,
} from '@aws-sdk/client-ecs'

import {
  CreateDBInstanceCommand,
  CreateDBInstanceCommandInput,
  DeleteDBInstanceCommand,
  DeleteDBInstanceMessage,
  DescribeDBInstancesCommand,
  paginateDescribeDBInstances,
  RDSClient,
  paginateDescribeDBEngineVersions,
  DescribeDBEngineVersionsCommand,
  ModifyDBInstanceCommand,
  ModifyDBInstanceCommandInput,
} from '@aws-sdk/client-rds'
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  DeleteLogGroupCommand,
  paginateDescribeLogGroups,
} from '@aws-sdk/client-cloudwatch-logs'
import {
  CreateRepositoryCommand as CreatePubRepositoryCommand,
  CreateRepositoryCommandInput as CreatePubRepositoryCommandInput,
  DeleteRepositoryCommand as DeletePubRepositoryCommand,
  DescribeRepositoriesCommand as DescribePubRepositoriesCommand,
  ECRPUBLICClient,
  paginateDescribeRepositories as paginateDescribePubRepositories,
} from '@aws-sdk/client-ecr-public'
import {
  ChangeAction,
  ChangeResourceRecordSetsCommand,
  CreateHostedZoneCommand,
  CreateHostedZoneCommandInput,
  DeleteHostedZoneCommand,
  GetHostedZoneCommand,
  ListResourceRecordSetsCommand,
  ListResourceRecordSetsCommandInput,
  paginateListHostedZones,
  ResourceRecordSet,
  Route53Client
} from '@aws-sdk/client-route-53'
import { IAM, paginateListRoles, } from '@aws-sdk/client-iam'
import {
  ACMClient,
  DeleteCertificateCommand,
  DescribeCertificateCommand,
  ImportCertificateCommand,
  ImportCertificateCommandInput,
  paginateListCertificates
} from '@aws-sdk/client-acm'
import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
} from '@aws-sdk/client-s3'

import logger from '../logger'

type AWSCreds = {
  accessKeyId: string,
  secretAccessKey: string
}

type AWSConfig = {
  credentials: AWSCreds,
  region: string
}

export const IASQL_EC2_TAG_NAME = 'IaSQL_Name';

export class AWS {
  private ec2client: EC2
  private ecrClient: ECRClient
  private elbClient: ElasticLoadBalancingV2Client
  private ecsClient: ECSClient
  private rdsClient: RDSClient
  private cwClient: CloudWatchLogsClient
  private ecrPubClient: ECRPUBLICClient
  private route53Client: Route53Client
  private iamClient: IAM;
  private acmClient: ACMClient
  private s3Client: S3Client
  private credentials: AWSCreds
  public region: string

  constructor(config: AWSConfig) {
    this.credentials = config.credentials;
    this.region = config.region;
    this.ec2client = new EC2(config);
    this.ecrClient = new ECRClient(config);
    this.elbClient = new ElasticLoadBalancingV2Client(config);
    this.ecsClient = new ECSClient(config);
    this.rdsClient = new RDSClient(config);
    this.cwClient = new CloudWatchLogsClient(config);
    this.route53Client = new Route53Client(config);
    this.iamClient = new IAM(config);
    this.acmClient = new ACMClient(config);
    // Technically available in multiple regions but with weird constraints, and the default is us-east-1
    this.s3Client = new S3Client({ ...config, region: 'us-east-1', });
    // Service endpoint only available in 'us-east-1' https://docs.aws.amazon.com/general/latest/gr/ecr-public.html
    this.ecrPubClient = new ECRPUBLICClient({credentials: config.credentials, region: 'us-east-1'});
  }

  async newRole(name: string, assumeRolePolicyDocument: string, attachedPolicyArns: string[], description: string): Promise<string> {
    const role = await this.iamClient.createRole({
      RoleName: name,
      AssumeRolePolicyDocument: assumeRolePolicyDocument,
      Description: description,
    });
    await Promise.all(
      attachedPolicyArns
        .map(arn => this.iamClient.attachRolePolicy({PolicyArn: arn, RoleName: name}))
    );
    return role.Role?.Arn ?? '';
  }

  async newRoleLin(
    name: string,
    assumeRolePolicyDocument: string,
    attachedPolicyArns: string[],
    description: string
  ): Promise<string> {
    const role = await this.iamClient.createRole({
      RoleName: name,
      AssumeRolePolicyDocument: assumeRolePolicyDocument,
      Description: description,
    });
    for (const arn of attachedPolicyArns) {
      this.iamClient.attachRolePolicy({PolicyArn: arn, RoleName: name});
    }
    return role.Role?.Arn ?? '';
  }

  async updateRoleDescription(name: string, description: string) {
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

  async getRoles() {
    return (await this.iamClient.listRoles({})).Roles ?? [];
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

  async deleteRole(name: string, policyArns: string[]) {
    await Promise.all(policyArns.map(arn => this.iamClient.detachRolePolicy({RoleName: name, PolicyArn: arn})));
    await this.iamClient.deleteRole({RoleName: name});
  }

  async deleteRoleLin(name: string, policyArns: string[]) {
    for (const arn of policyArns) {
      await this.iamClient.detachRolePolicy({RoleName: name, PolicyArn: arn});
    }
    await this.iamClient.deleteRole({RoleName: name});
  }

  async newInstance(name: string, instanceType: string, amiId: string, securityGroupIds: string[], keyPairName?: string): Promise<string> {
    const instanceParams: RunInstancesCommandInput = {
      ImageId: amiId,
      InstanceType: instanceType,
      MinCount: 1,
      MaxCount: 1,
      SecurityGroupIds: securityGroupIds,
      TagSpecifications: [
        {
          ResourceType: 'instance',
          Tags: [
            { Key: IASQL_EC2_TAG_NAME, Value: name },
            { Key: 'owner', Value: 'iasql-change-engine' },
          ],
        },
      ],
      UserData: undefined,
    };
    if (keyPairName) instanceParams.KeyName = keyPairName;
    const create = await this.ec2client.send(
      new RunInstancesCommand(instanceParams),
    );
    const instanceIds: string[] | undefined = create.Instances?.map((i) => i?.InstanceId ?? '');
    const input = new DescribeInstancesCommand({
      InstanceIds: instanceIds,
    });
    // TODO: should we use the paginator instead?
    await createWaiter<EC2Client, DescribeInstancesCommand>(
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
          const data = await client.send(cmd);
          for (const reservation of data?.Reservations ?? []) {
            for (const instance of reservation?.Instances ?? []) {
              if (instance.PublicIpAddress === undefined)
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

  async newInstanceV2(instanceType: string, amiId: string, securityGroupIds: string[], keyPairName?: string, tags?: { [key: string] : string }): Promise<string> {
    let tgs: Tag[] = [];
    if (tags) {
      tags.owner = 'iasql-engine';
      tgs = Object.keys(tags).map(k => {
        return {
          Key: k, Value: tags[k]
        }
      });
    }
    const instanceParams: RunInstancesCommandInput = {
      ImageId: amiId,
      InstanceType: instanceType,
      MinCount: 1,
      MaxCount: 1,
      SecurityGroupIds: securityGroupIds,
      TagSpecifications: [
        {
          ResourceType: 'instance',
          Tags: tgs,
        },
      ],
      UserData: undefined,
    };
    if (keyPairName) instanceParams.KeyName = keyPairName;
    const create = await this.ec2client.send(
      new RunInstancesCommand(instanceParams),
    );
    const instanceIds: string[] | undefined = create.Instances?.map((i) => i?.InstanceId ?? '');
    const input = new DescribeInstancesCommand({
      InstanceIds: instanceIds,
    });
    // TODO: should we use the paginator instead?
    await createWaiter<EC2Client, DescribeInstancesCommand>(
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
          const data = await client.send(cmd);
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
    const input = new DescribeInstancesCommand({
      InstanceIds: [instanceId],
    });
    await createWaiter<EC2Client, DescribeInstancesCommand>(
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
          const data = await client.send(cmd);
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
    const input = new DescribeInstancesCommand({
      InstanceIds: [instanceId],
    });
    await createWaiter<EC2Client, DescribeInstancesCommand>(
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
          const data = await client.send(cmd);
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

  async updateTags(instanceId: string, tags: { [key: string] : string }) {
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
      Resources: [instanceId],
    });
    await this.ec2client.createTags({
      Resources: [instanceId],
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

  async getInstance(id: string) {
    const reservations = await this.ec2client.send(
      new DescribeInstancesCommand({ InstanceIds: [id], })
    );
    return (reservations?.Reservations?.map(r => r.Instances?.map(i => i)) ?? []).pop()?.pop();
  }

  async terminateInstance(id: string) {
    const response = await this.ec2client.send(
      new TerminateInstancesCommand({ InstanceIds: [id], })
    );
    return (response?.TerminatingInstances ?? []).pop();
  }

  async getInstanceTypes() {
    const instanceTypes = [];
    const paginator = paginateDescribeInstanceTypes({
      client: this.ec2client,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      instanceTypes.push(...(page.InstanceTypes ?? []));
    }
    return {
      InstanceTypes: instanceTypes, // Make it "look like" the regular query again
    };
  }

  async getInstanceType(instanceType: string) {
    return (await this.ec2client.send(
      new DescribeInstanceTypesCommand({
        InstanceTypes: [instanceType,],
      })
    ))?.InstanceTypes?.[0];
  }

  async getAMIs() {
    return await this.ec2client.send(new DescribeImagesCommand({}));
  }

  async getAMI(imageId: string) {
    return (await this.ec2client.send(new DescribeImagesCommand({
      ImageIds: [imageId,],
    })))?.Images?.[0];
  }

  async getRegions() {
    return await this.ec2client.send(new DescribeRegionsCommand({ AllRegions: true, }));
  }

  async getRegion(regionName: string) {
    return (await this.ec2client.send(new DescribeRegionsCommand({
      RegionNames: [regionName,],
    })))?.Regions?.[0];
  }

  async getAvailabilityZones(regions: string[]): Promise<AvailabilityZone[]> {
    let availabilityZones: AvailabilityZone[] = [];
    for (const region of regions) {
      try {
        const client = new EC2Client({
          credentials: this.credentials,
          region
        });
        const regionAZs = await client.send(new DescribeAvailabilityZonesCommand({ AllAvailabilityZones: true, }));
        availabilityZones = availabilityZones.concat(regionAZs.AvailabilityZones ?? []);
      } catch (e) {
        logger.info(`Could not get availability zones for region: ${region}. Error: ${e}`);
      }
    }
    return availabilityZones;
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
    const group = await this.ec2client.send(
      new DescribeSecurityGroupsCommand({ GroupIds: [id], })
    );
    return (group?.SecurityGroups ?? [])[0];
  }

  async createSecurityGroup(instanceParams: CreateSecurityGroupRequest) {
    return await this.ec2client.send(
      new CreateSecurityGroupCommand(instanceParams),
    );
  }

  async deleteSecurityGroup(instanceParams: DeleteSecurityGroupRequest) {
    try {
      return await this.ec2client.send(
        new DeleteSecurityGroupCommand(instanceParams),
      );
    } catch(e: any) {
      // If it is a dependency violation we add the dependency to the error message in order to debug what is happening
      if (e.Code === 'DependencyViolation') {
        const sgEniInfo = await this.ec2client.send(
          new DescribeNetworkInterfacesCommand({
            Filters: [
              {
                Name: 'group-id',
                Values: [`${instanceParams.GroupId}`]
              }
            ]
          })
        );
        const eniMessage = `Network interfaces associated with security group ${instanceParams.GroupId}: ${JSON.stringify(sgEniInfo.NetworkInterfaces)}`;
        e.message = `${e.message} | ${eniMessage}`;
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
    const rule = await this.ec2client.send(
      new DescribeSecurityGroupRulesCommand({ SecurityGroupRuleIds: [id], })
    );
    return (rule?.SecurityGroupRules ?? [])[0];
  }

  async createSecurityGroupEgressRules(is: AuthorizeSecurityGroupEgressCommandInput[]) {
    const reses = [];
    for (const i of is) {
      const res = await this.ec2client.send(
        new AuthorizeSecurityGroupEgressCommand(i)
      );
      reses.push(res);
    }
    return reses;
  }

  async createSecurityGroupIngressRules(is: AuthorizeSecurityGroupIngressCommandInput[]) {
    const reses = [];
    for (const i of is) {
      const res = await this.ec2client.send(
        new AuthorizeSecurityGroupIngressCommand(i)
      );
      reses.push(res);
    }
    return reses;
  }

  async deleteSecurityGroupEgressRules(is: RevokeSecurityGroupEgressCommandInput[]) {
    const reses = [];
    for (const i of is) {
      const res = await this.ec2client.send(
        new RevokeSecurityGroupEgressCommand(i)
      );
      reses.push(res);
    }
    return reses;
  }

  async deleteSecurityGroupIngressRules(is: RevokeSecurityGroupIngressCommandInput[]) {
    const reses = [];
    for (const i of is) {
      const res = await this.ec2client.send(
        new RevokeSecurityGroupIngressCommand(i)
      );
      reses.push(res);
    }
    return reses;
  }

  async modifySecurityGroupRules(i: ModifySecurityGroupRulesCommandInput): Promise<ModifySecurityGroupRulesCommandOutput> {
    return await this.ec2client.send(
      new ModifySecurityGroupRulesCommand(i),
    );
  }

  async createECRRepository(input: CreateRepositoryCommandInput) {
    const repository = await this.ecrClient.send(
      new CreateRepositoryCommand(input),
    );
    return repository.repository;
  }

  async updateECRRepositoryImageScanningConfiguration(repositoryName: string, scanOnPush: boolean) {
    await this.ecrClient.send(
      new PutImageScanningConfigurationCommand({
        repositoryName,
        imageScanningConfiguration: { scanOnPush }
      }),
    );
    const repository = await this.getECRRepository(repositoryName);
    return repository;
  }

  async updateECRRepositoryImageTagMutability(repositoryName: string, imageTagMutability: string) {
    await this.ecrClient.send(
      new PutImageTagMutabilityCommand({
        repositoryName,
        imageTagMutability,
      }),
    );
    const repository = await this.getECRRepository(repositoryName);
    return repository;
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
    const repositories = await this.ecrClient.send(
      new DescribeRepositoriesCommand({
        repositoryNames: [name],
      }),
    );
    return (repositories.repositories ?? [])[0];
  }

  async deleteECRRepository(name: string) {
    return await this.ecrClient.send(
      new DeleteRepositoryCommand({
        repositoryName: name,
      }),
    );
  }

  async getECRRepositoryPolicy(repositoryName: string) {
    const policy = await this.ecrClient.send(
      new GetRepositoryPolicyCommand({
        repositoryName,
      })
    );
    return policy;
  }

  async setECRRepositoryPolicy(input: SetRepositoryPolicyCommandInput) {
    const policy = await this.ecrClient.send(
      new SetRepositoryPolicyCommand(input)
    );
    return policy;
  }

  async deleteECRRepositoryPolicy(repositoryName: string) {
    const policy = await this.ecrClient.send(
      new DeleteRepositoryPolicyCommand({
        repositoryName,
      })
    );
    return policy;
  }

  async createListener(input: CreateListenerCommandInput) {
    const create = await this.elbClient.send(
      new CreateListenerCommand(input),
    );
    return create?.Listeners?.pop() ?? null;
  }

  async updateListener(input: ModifyListenerCommandInput) {
    const update = await this.elbClient.send(
      new ModifyListenerCommand(input),
    );
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
    const result = await this.elbClient.send(
      new DescribeListenersCommand({ ListenerArns: [arn], })
    );
    return result?.Listeners?.[0];
  }

  async deleteListener(arn: string) {
    await this.elbClient.send(
      new DeleteListenerCommand({ ListenerArn: arn, })
    );
  }

  async createLoadBalancer(input: CreateLoadBalancerCommandInput) {
    const create = await this.elbClient.send(
      new CreateLoadBalancerCommand(input),
    );
    let loadBalancer = create?.LoadBalancers?.pop() ?? null;
    if (!loadBalancer) return loadBalancer;
    const waiterInput = new DescribeLoadBalancersCommand({
      LoadBalancerArns: [loadBalancer?.LoadBalancerArn!],
    });
    // TODO: should we use the paginator instead?
    await createWaiter<ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand>(
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
          const data = await client.send(cmd);
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
    await this.elbClient.send(
      new SetIpAddressTypeCommand(input),
    );
    const loadBalancer = await this.getLoadBalancer(input.LoadBalancerArn!);
    return loadBalancer;
  }

  async updateLoadBalancerSubnets(input: SetSubnetsCommandInput) {
    await this.elbClient.send(
      new SetSubnetsCommand(input),
    );
    const loadBalancer = await this.getLoadBalancer(input.LoadBalancerArn!);
    return loadBalancer;
  }

  async updateLoadBalancerSecurityGroups(input: SetSecurityGroupsCommandInput) {
    await this.elbClient.send(
      new SetSecurityGroupsCommand(input),
    );
    const loadBalancer = await this.getLoadBalancer(input.LoadBalancerArn!);
    return loadBalancer;
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
    const result = await this.elbClient.send(
      new DescribeLoadBalancersCommand({ LoadBalancerArns: [arn], })
    );
    return result?.LoadBalancers?.[0];
  }

  async deleteLoadBalancer(arn: string) {
    await this.elbClient.send(
      new DeleteLoadBalancerCommand({ LoadBalancerArn: arn, })
    );
    // We wait it is completely deleted to avoid issues deleting dependent resources.
    const input = new DescribeLoadBalancersCommand({ LoadBalancerArns: [arn], });
    await createWaiter<ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand>(
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
          await client.send(cmd);
          return { state: WaiterState.RETRY };
        } catch (_) {
          return { state: WaiterState.SUCCESS };
        }
      },
    );
    // Now we need wait the load balancer to be fully deattached from any network interface
    const loadBalancerName = arn.split(':loadbalancer/')?.[1] ?? '';
    const describeEniCommand = new DescribeNetworkInterfacesCommand({
      Filters: [
        {
          Name: 'description',
          Values: [`*${loadBalancerName}`]
        }
      ]
    });
    await createWaiter<EC2Client, DescribeNetworkInterfacesCommand>(
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
          const eni = await client.send(cmd);
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
    const create = await this.elbClient.send(
      new CreateTargetGroupCommand(input),
    );
    return create?.TargetGroups?.pop() ?? null;
  }

  async updateTargetGroup(input: ModifyTargetGroupCommandInput) {
    const update = await this.elbClient.send(
      new ModifyTargetGroupCommand(input),
    );
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
    const result = await this.elbClient.send(
      new DescribeTargetGroupsCommand({ TargetGroupArns: [arn], })
    );
    return result?.TargetGroups?.[0];
  }

  async deleteTargetGroup(arn: string) {
    await this.elbClient.send(
      new DeleteTargetGroupCommand({ TargetGroupArn: arn, })
    );
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
    const vpcs = await this.ec2client.send(
      new DescribeVpcsCommand({ VpcIds: [id], })
    );
    return vpcs?.Vpcs?.[0];
  }

  async createVpc(input: CreateVpcCommandInput) {
    return await this.ec2client.send(
      new CreateVpcCommand(input)
    );
  }

  async deleteVpc(input: DeleteVpcCommandInput) {
    return await this.ec2client.send(
      new DeleteVpcCommand(input)
    );
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
    const subnets = await this.ec2client.send(
      new DescribeSubnetsCommand({ SubnetIds: [id], })
    );
    return subnets?.Subnets?.[0];
  }

  async createSubnet(input: CreateSubnetCommandInput) {
    return await this.ec2client.send(
      new CreateSubnetCommand(input)
    );
  }

  async deleteSubnet(input: DeleteSubnetCommandInput) {
    return await this.ec2client.send(
      new DeleteSubnetCommand(input)
    );
  }

  async createCluster(input: CreateClusterCommandInput) {
    const result = await this.ecsClient.send(
      new CreateClusterCommand(input)
    );
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
    const result = await this.ecsClient.send(
      new DescribeClustersCommand({
        clusters: clusterArns
      })
    );
    return result.clusters;
  }

  async getCluster(id: string) {
    const cluster = await this.ecsClient.send(
      new DescribeClustersCommand({
        clusters: [id]
      })
    );
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
    await this.ecsClient.send(
      new DeleteClusterCommand({
        cluster: id,
      })
    );
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
    await this.ecsClient.send(
      new DeleteClusterCommand({
        cluster: id,
      })
    );
  }

  async createTaskDefinition(input: RegisterTaskDefinitionCommandInput) {
    const taskDefinition = await this.ecsClient.send(
      new RegisterTaskDefinitionCommand(input)
    );
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
    const taskDefinition = await this.ecsClient.send(
      new DescribeTaskDefinitionCommand({
        taskDefinition: id
      })
    );
    return taskDefinition.taskDefinition;
  }

  async deleteTaskDefinition(name: string) {
    await this.ecsClient.send(
      new DeregisterTaskDefinitionCommand({
        taskDefinition: name
      })
    );
  }

  async createService(input: CreateServiceCommandInput) {
    const result = await this.ecsClient.send(
      new CreateServiceCommand(input)
    );
    return result.service;
  }

  async updateService(input: UpdateServiceCommandInput) {
    const result = await this.ecsClient.send(
      new UpdateServiceCommand(input)
    );
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
            const result = await this.ecsClient.send(
              new DescribeServicesCommand({
                cluster: id,
                services: batch
              })
            );
            services.push(...(result.services ?? []));
          }
        } else {
          const result = await this.ecsClient.send(
            new DescribeServicesCommand({
              cluster: id,
              services: serviceArns
            })
          );
          services.push(...(result.services ?? []));
        }
      }
    }
    return services;
  }

  async getService(id: string, cluster: string) {
    const result = await this.ecsClient.send(
      new DescribeServicesCommand({
        services: [id],
        cluster,
      })
    );
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
          const result = await this.ecsClient.send(
            new DescribeServicesCommand({
              cluster,
              services: batch
            })
          );
          services.push(...(result.services ?? []));
        }
      } else {
        const result = await this.ecsClient.send(
          new DescribeServicesCommand({
            cluster,
            services: serviceArns
          })
        );
        services.push(...(result.services ?? []));
      }
    }
    return services.find(s => Object.is(s.serviceName, name));
  }

  async deleteService(name: string, cluster: string, tasksArns: string[]) {
    await this.ecsClient.send(
      new DeleteServiceCommand({
        service: name,
        cluster,
      })
    )
    // We wait it is completely deleted to avoid issues deleting dependent resources.
    const input = new DescribeServicesCommand({
      services: [name],
      cluster,
    });
    await createWaiter<ECSClient, DescribeServicesCommand>(
      {
        client: this.ecsClient,
        // all in seconds
        maxWaitTime: 600,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (client, cmd) => {
        const data = await client.send(cmd);
        if (data.services?.length && data.services[0].status === 'DRAINING') {
          return { state: WaiterState.RETRY };
        } else {
          return { state: WaiterState.SUCCESS };
        }
      },
    );
    try {
      const tasks = await this.ecsClient.send(new DescribeTasksCommand({tasks: tasksArns, cluster}));
      const taskAttachmentIds = tasks.tasks?.map(t => t.attachments?.map(a => a.id)).flat()
      if (taskAttachmentIds?.length) {
        const describeEniCommand = new DescribeNetworkInterfacesCommand({
          Filters: [
            {
              Name: 'description',
              Values: taskAttachmentIds?.map(id => `*${id}`)
            }
          ]
        });
        await createWaiter<EC2Client, DescribeNetworkInterfacesCommand>(
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
              const eni = await client.send(cmd);
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

  async getEngineVersions() {
    const engines = [];
    const paginator = paginateDescribeDBEngineVersions({
      client: this.rdsClient,
      pageSize: 100,
    }, {});
    for await (const page of paginator) {
      engines.push(...(page.DBEngineVersions ?? []));
    }
    return {
      DBEngineVersions: engines.map(e =>
        ({ ...e, EngineVersionKey: `${e.Engine}:${e.EngineVersion}` })),
    };
  }

  async getEngineVersion(engineVersionKey: string) {
    const [engine, version] = engineVersionKey.split(':');
    let dbEngineVersion: any = (await this.rdsClient.send(new DescribeDBEngineVersionsCommand({
      Engine: engine,
      EngineVersion: version,
    })))?.DBEngineVersions?.[0];
    if (dbEngineVersion) {
      dbEngineVersion = {
        ...dbEngineVersion,
        EngineVersionKey: `${dbEngineVersion!.Engine}:${dbEngineVersion!.EngineVersion}`
      }
    }
    return dbEngineVersion;
  }

  async createDBInstance(instanceParams: CreateDBInstanceCommandInput) {
    let newDBInstance = (await this.rdsClient.send(
      new CreateDBInstanceCommand(instanceParams),
    )).DBInstance;
    const input = new DescribeDBInstancesCommand({
      DBInstanceIdentifier: instanceParams.DBInstanceIdentifier,
    });
    // TODO: should we use the paginator instead?
    await createWaiter<RDSClient, DescribeDBInstancesCommand>(
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
          const data = await client.send(cmd);
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
    const dbInstance = await this.rdsClient.send(
      new DescribeDBInstancesCommand({ DBInstanceIdentifier: id, }),
    );
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
    await this.rdsClient.send(
      new DeleteDBInstanceCommand(deleteInput),
    );
    const inputCommand = new DescribeDBInstancesCommand({
      DBInstanceIdentifier: deleteInput.DBInstanceIdentifier,
    });
    await createWaiter<RDSClient, DescribeDBInstancesCommand>(
      {
        client: this.rdsClient,
        // all in seconds
        maxWaitTime: 1200,
        minDelay: 1,
        maxDelay: 4,
      },
      inputCommand,
      async (client, cmd) => {
        const data = await client.send(cmd);
        for (const dbInstance of data?.DBInstances ?? []) {
          if (dbInstance.DBInstanceStatus === 'deleting')
            return { state: WaiterState.RETRY };
        }
        return { state: WaiterState.SUCCESS };
      },
    );
  }

  async updateDBInstance(input: ModifyDBInstanceCommandInput) {
    let updatedDBInstance = (await this.rdsClient.send(
      new ModifyDBInstanceCommand(input)
    ))?.DBInstance;
    const inputCommand = new DescribeDBInstancesCommand({
      DBInstanceIdentifier: input.DBInstanceIdentifier,
    });
    await createWaiter<RDSClient, DescribeDBInstancesCommand>(
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
          const data = await client.send(cmd);
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
    await createWaiter<RDSClient, DescribeDBInstancesCommand>(
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
          const data = await client.send(cmd);
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
    await this.cwClient.send(
      new CreateLogGroupCommand({
        logGroupName: groupName,
      }),
    );
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
    await this.cwClient.send(
      new DeleteLogGroupCommand({
        logGroupName: groupName,
      }),
    );
  }

  async createECRPubRepository(input: CreatePubRepositoryCommandInput) {
    const repository = await this.ecrPubClient.send(
      new CreatePubRepositoryCommand(input),
    );
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
    const repositories = await this.ecrPubClient.send(
      new DescribePubRepositoriesCommand({
        repositoryNames: [name],
      }),
    );
    return (repositories.repositories ?? [])[0];
  }

  async deleteECRPubRepository(name: string) {
    return await this.ecrPubClient.send(
      new DeletePubRepositoryCommand({
        repositoryName: name,
      }),
    );
  }

  async createHostedZone(domainName: string) {
    const input: CreateHostedZoneCommandInput = {
      Name: domainName,
      CallerReference: `${this.region}-${Date.now()}`,
    }
    const res = await this.route53Client.send(
      new CreateHostedZoneCommand(input)
    );
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
    const res = await this.route53Client.send(
      new GetHostedZoneCommand({
        Id: hostedZoneId,
      })
    );
    return res.HostedZone;
  }

  async deleteHostedZone(hostedZoneId: string) {
    const res = await this.route53Client.send(
      new DeleteHostedZoneCommand({
        Id: hostedZoneId,
      })
    );
    return res.ChangeInfo;
  }

  newChangeResourceRecordSetsCommand(hostedZoneId: string, record: ResourceRecordSet, action: ChangeAction) {
    return new ChangeResourceRecordSetsCommand({
      HostedZoneId: hostedZoneId,
      ChangeBatch: {
        Changes: [{
          Action: action,
          ResourceRecordSet: record
        }]
      }
    })
  }

  async createResourceRecordSet(hostedZoneId: string, record: ResourceRecordSet) {
    const res = await this.route53Client.send(
      this.newChangeResourceRecordSetsCommand(hostedZoneId, record, 'CREATE')
    );
    return res;
  }

  async getRecords(hostedZoneId: string) {
    const records = [];
    let res;
    do {
      const listResourceRecordSetsCommandInput: ListResourceRecordSetsCommandInput = {
        HostedZoneId: hostedZoneId,
      };
      if (res?.NextRecordName) {
        listResourceRecordSetsCommandInput.StartRecordName = res.NextRecordName;
      }
      res = await this.route53Client.send(
        new ListResourceRecordSetsCommand(listResourceRecordSetsCommandInput)
      );
      records.push(...(res.ResourceRecordSets ?? []));
    } while (res?.IsTruncated);
    return records;
  }

  async getRecord(hostedZoneId: string, recordName: string, recordType: string) {
    const records = await this.getRecords(hostedZoneId);
    return records.find(r => Object.is(r.Type, recordType) && Object.is(r.Name, recordName));
  }

  async updateResourceRecordSet(hostedZoneId: string, record: ResourceRecordSet) {
    const res = await this.route53Client.send(
      this.newChangeResourceRecordSetsCommand(hostedZoneId, record, 'UPSERT')
    );
    return res;
  }

  async deleteResourceRecordSet(hostedZoneId: string, record: ResourceRecordSet) {
    const res = await this.route53Client.send(
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
      const c = await this.acmClient.send(
        new DescribeCertificateCommand({ CertificateArn: certificate.CertificateArn })
      );
      certificates.push(c.Certificate);
    }
    return certificates;
  }

  async getCertificate(arn: string) {
    const res = await this.acmClient.send(
      new DescribeCertificateCommand({ CertificateArn: arn })
    );
    return res.Certificate;
  }

  async deleteCertificate(arn: string) {
    await this.acmClient.send(
      new DeleteCertificateCommand({ CertificateArn: arn })
    );
    let certificates: string[] = [];
    let i = 0;
     // Wait for ~1min until imported cert is available
    do {
      const start = Date.now();
      while (Date.now() - start < 2000); // Sleep for 2s
      certificates = (await this.getCertificatesSummary())?.map(c => c.CertificateArn ?? '') ?? [];
      i++;
    } while (!certificates.includes(arn) && i < 30);
  }

  async importCertificate(input: ImportCertificateCommandInput) {
    const res = await this.acmClient.send(
      new ImportCertificateCommand(input)
    );
    const arn = res.CertificateArn ?? '';
    let certificates: string[] = [];
    let i = 0;
     // Wait for ~1min until imported cert is available
    do {
      const start = Date.now();
      while (Date.now() - start < 2000); // Sleep for 2s
      certificates = (await this.getCertificatesSummary())?.map(c => c.CertificateArn ?? '') ?? [];
      i++;
    } while (!certificates.includes(arn) && i < 30);
    return arn;
  }

  async getBuckets() {
    const res = await this.s3Client.send(
      new ListBucketsCommand({})
    );
    return res.Buckets ?? [];
  }

  async createBucket(name: string) {
    const res = await this.s3Client.send(
      new CreateBucketCommand({
        Bucket: name, // Even the little things are inconsistent with the AWS API
      })
    );
    return res;
  }

  async deleteBucket(name: string) {
    const res = await this.s3Client.send(
      new DeleteBucketCommand({
        Bucket: name,
      })
    );
    return res;
  }

  async getRegisteredInstances() {
    const targetGroups = await this.getTargetGroups();
    const instanceTargetGroups = targetGroups?.TargetGroups?.filter(tg => Object.is(tg.TargetType, TargetTypeEnum.INSTANCE)) ?? [];
    const out = [];
    for (const tg of instanceTargetGroups) {
      const res = await this.elbClient.send(
        new DescribeTargetHealthCommand({
          TargetGroupArn: tg.TargetGroupArn,
        })
      );
      out.push(...(res.TargetHealthDescriptions?.map(thd => (
        {
          targetGroupArn: tg.TargetGroupArn,
          instanceId: thd.Target?.Id
        }
      )) ?? []));
    }
    return out;
  } 

  async registerInstance(instanceId: string, targetGroupArn: string) {
    await this.elbClient.send(new RegisterTargetsCommand({
      TargetGroupArn: targetGroupArn,
      Targets: [
        {
          Id: instanceId,
        }
      ],
    }));
  }

  async deregisterInstance(instanceId: string, targetGroupArn: string) {
    await this.elbClient.send(new DeregisterTargetsCommand({
      TargetGroupArn: targetGroupArn,
      Targets: [
        {
          Id: instanceId,
        }
      ],
    }));
  }
}
