import {
  AuthorizeSecurityGroupEgressCommand,
  AuthorizeSecurityGroupEgressCommandInput,
  AuthorizeSecurityGroupIngressCommand,
  AuthorizeSecurityGroupIngressCommandInput,
  AvailabilityZone,
  CreateSecurityGroupCommand,
  CreateSecurityGroupRequest,
  DeleteSecurityGroupCommand,
  DeleteSecurityGroupRequest,
  DescribeInstanceTypesCommand,
  // DescribeInstanceTypesRequest,
  DescribeAvailabilityZonesCommand,
  DescribeImagesCommand,
  DescribeInstancesCommand,
  DescribeRegionsCommand,
  DescribeSecurityGroupsCommand,
  DescribeSecurityGroupRulesCommand,
  EC2Client,
  ModifySecurityGroupRulesCommand,
  ModifySecurityGroupRulesCommandInput,
  ModifySecurityGroupRulesCommandOutput,
  RevokeSecurityGroupEgressCommand,
  RevokeSecurityGroupEgressCommandInput,
  RevokeSecurityGroupIngressCommand,
  RevokeSecurityGroupIngressCommandInput,
  RunInstancesCommand,
  TerminateInstancesCommand,
  // TerminateInstancesRequest,
  paginateDescribeInstanceTypes,
  paginateDescribeInstances,
  paginateDescribeSecurityGroupRules,
  paginateDescribeSecurityGroups,
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

type AWSCreds = {
  accessKeyId: string,
  secretAccessKey: string
}

type AWSConfig = {
  credentials: AWSCreds,
  region: string
}

export class AWS {
  private ec2client: EC2Client
  private ecrClient: ECRClient
  private credentials: AWSCreds
  public region: string

  constructor(config: AWSConfig) {
    this.credentials = config.credentials;
    this.region = config.region;
    this.ec2client = new EC2Client(config);
    this.ecrClient = new ECRClient(config);
  }

  async newInstance(instanceType: string, amiId: string, securityGroupIds: string[]): Promise<string> {
    const instanceParams = {
      ImageId: amiId,
      InstanceType: instanceType,
      MinCount: 1,
      MaxCount: 1,
      SecurityGroupIds: securityGroupIds,
      TagSpecifications: [
        {
          ResourceType: 'instance',
          Tags: [{ Key: 'owner', Value: 'iasql-change-engine' }],
        },
      ],
      UserData: undefined,
    };
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
        maxWaitTime: 180,
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
        InstanceTypes: [ instanceType, ],
      })
    ))?.InstanceTypes?.[0];
  }

  async getAMIs() {
    return await this.ec2client.send(new DescribeImagesCommand({}));
  }

  async getAMI(imageId: string) {
    return (await this.ec2client.send(new DescribeImagesCommand({
      ImageIds: [ imageId, ],
    })))?.Images?.[0];
  }

  async getRegions() {
    return await this.ec2client.send(new DescribeRegionsCommand({ AllRegions: true, }));
  }

  async getRegion(regionName: string) {
    return (await this.ec2client.send(new DescribeRegionsCommand({
      RegionNames: [ regionName, ],
    })))?.Regions?.[0];
  }

  async getAvailabilityZones(regions: string[]) {
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
        console.log(`Could not get availability zones for region: ${region}. Error: ${e}`);
      }
    }
    return { AvailabilityZones: availabilityZones }
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
    return await this.ec2client.send(
      new DeleteSecurityGroupCommand(instanceParams),
    );
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

  async updateECRRepository(input: { repositoryName: string, scanOnPush: boolean, imageTagMutability: string }) {
    await Promise.all([
      this.ecrClient.send(
        new PutImageScanningConfigurationCommand({
          repositoryName: input.repositoryName,
          imageScanningConfiguration: { scanOnPush: input.scanOnPush }
        }),
      ),
      this.ecrClient.send(
        new PutImageTagMutabilityCommand({
          repositoryName: input.repositoryName,
          imageTagMutability: input.imageTagMutability,
        }),
      )
    ]);
    const repository = await this.getECRRepository(input.repositoryName);
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
}
