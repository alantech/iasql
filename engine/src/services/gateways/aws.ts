import {
  AvailabilityZone,
  CreateSecurityGroupCommand,
  CreateSecurityGroupRequest,
  DeleteSecurityGroupCommand,
  DeleteSecurityGroupRequest,
  DescribeInstanceTypesCommand,
  DescribeAvailabilityZonesCommand,
  DescribeImagesCommand,
  DescribeInstancesCommand,
  DescribeRegionsCommand,
  DescribeSecurityGroupsCommand,
  EC2Client,
  RunInstancesCommand,
  TerminateInstancesCommand,
  paginateDescribeInstanceTypes,
  paginateDescribeInstances,
  paginateDescribeSecurityGroupRules,
  paginateDescribeSecurityGroups,
  Vpc,
  CreateVpcCommandInput,
  CreateVpcCommand,
  DescribeVpcsCommand,
  paginateDescribeVpcs,
  DeleteVpcCommand,
  CreateSubnetCommandInput,
  Subnet,
  CreateSubnetCommand,
  paginateDescribeSubnets,
  DescribeSubnetsCommand,
  DeleteSubnetCommand,
} from '@aws-sdk/client-ec2'
import {
  ECRClient,
  CreateRepositoryCommandInput,
  CreateRepositoryCommand,
  paginateDescribeRepositories,
  DescribeRepositoriesCommand,
  DeleteRepositoryCommand,
  GetRepositoryPolicyCommand,
  SetRepositoryPolicyCommandInput,
  SetRepositoryPolicyCommand,
  DeleteRepositoryPolicyCommand,
} from '@aws-sdk/client-ecr'
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
  CreateLoadBalancerCommand,
  CreateLoadBalancerCommandInput,
  CreateTargetGroupCommand,
  CreateTargetGroupCommandInput,
  DeleteTargetGroupCommand,
  DescribeTargetGroupsCommand,
  ElasticLoadBalancingV2Client,
  ModifyTargetGroupCommand,
  ModifyTargetGroupCommandInput,
  paginateDescribeTargetGroups,
  TargetGroup,
  LoadBalancer,
  paginateDescribeLoadBalancers,
  DescribeLoadBalancersCommand,
  DeleteLoadBalancerCommand,
  CreateListenerCommand,
  CreateListenerCommandInput,
  Listener,
  paginateDescribeListeners,
  DescribeListenersCommand,
  DeleteListenerCommand,
} from '@aws-sdk/client-elastic-load-balancing-v2'
import {
  CreateDBInstanceCommand,
  CreateDBInstanceCommandInput,
  DeleteDBInstanceCommand,
  DeleteDBInstanceMessage,
  DescribeDBInstancesCommand,
  paginateDescribeDBInstances,
  RDSClient,
  paginateDescribeDBEngineVersions,
  paginateDescribeOrderableDBInstanceOptions,
  paginateDescribeDBSecurityGroups,
  DescribeDBSecurityGroupsCommand,
  DescribeDBEngineVersionsCommand,
  ModifyDBInstanceCommand,
  ModifyDBInstanceCommandInput,
} from '@aws-sdk/client-rds'
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter'

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
  private rdsClient: RDSClient
  private ecsClient: ECSClient
  private elbClient: ElasticLoadBalancingV2Client
  private credentials: AWSCreds
  public region: string

  constructor(config: AWSConfig) {
    if (!config?.credentials?.accessKeyId || !config?.credentials?.secretAccessKey) {
      throw new Error('Invalid AWS credentials');
    }
    this.credentials = config.credentials;
    this.region = config.region;
    this.ec2client = new EC2Client(config);
    this.ecrClient = new ECRClient(config);
    this.rdsClient = new RDSClient(config);
    this.ecsClient = new ECSClient(config);
    this.elbClient = new ElasticLoadBalancingV2Client(config);
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

  async getAvailabilityZoneByName(azName: string) {
    return (await this.ec2client.send(new DescribeAvailabilityZonesCommand({
      ZoneNames: [azName],
    })))?.AvailabilityZones?.[0];
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

  async createECRRepository(input: CreateRepositoryCommandInput) {
    const repository = await this.ecrClient.send(
      new CreateRepositoryCommand(input),
    );
    return repository.repository;
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
        maxWaitTime: 600,
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
      dbInstances.push(...(page.DBInstances ?? []));
    }
    return {
      DBInstances: dbInstances, // Make it "look like" the regular query again
    };
  }

  async deleteDBInstance(deleteInput: DeleteDBInstanceMessage) {
    return await this.rdsClient.send(
      new DeleteDBInstanceCommand(deleteInput),
    );
  }

  async getOrderableInstanceOptions(engines: string[]) {
    let orderableInstanceOptions = [];
    for (const engine of engines) {
      const paginator = paginateDescribeOrderableDBInstanceOptions({
        client: this.rdsClient,
        pageSize: 100,
      }, { Engine: engine, });
      for await (const page of paginator) {
        orderableInstanceOptions.push(...(page.OrderableDBInstanceOptions ?? []));
      }
    }
    orderableInstanceOptions = orderableInstanceOptions.map(opt => ({
      ...opt,
      CompositeKey: opt.Engine! + opt.EngineVersion! + opt.DBInstanceClass! + opt.StorageType
    }));
    return {
      OrderableDBInstanceOptions: orderableInstanceOptions,
    };
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

  async getDBSecurityGroups() {
    const dbSecurityGroups = [];
    const paginator = paginateDescribeDBSecurityGroups({
      client: this.rdsClient,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      dbSecurityGroups.push(...(page.DBSecurityGroups ?? []));
    }
    return {
      DBSecurityGroups: dbSecurityGroups,
    };
  }

  async getDBSecurityGroup(sgName: string) {
    return (await this.rdsClient.send(new DescribeDBSecurityGroupsCommand({
      DBSecurityGroupName: sgName,
    })))?.DBSecurityGroups?.[0];
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
        maxWaitTime: 120,
        minDelay: 1,
        maxDelay: 4,
      },
      inputCommand,
      async (client, cmd) => {
        try {
          const data = await client.send(cmd);
          for (const dbInstance of data?.DBInstances ?? []) {
            if (dbInstance.DBInstanceStatus !== 'modifying')
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
        maxWaitTime: 600,
        minDelay: 1,
        maxDelay: 4,
      },
      inputCommand,
      async (client, cmd) => {
        try {
          const data = await client.send(cmd);
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

  async createTaskDefinition(input: RegisterTaskDefinitionCommandInput) {
    const taskDefinition = await this.ecsClient.send(
      new RegisterTaskDefinitionCommand(input)
    );
    return taskDefinition.taskDefinition;
  }

  async getTaskDefinitions() {
    const taskDefinitions: any[] = [];
    const taskDefinitionArns: string[] = [];
    const paginator = paginateListTaskDefinitions({
      client: this.ecsClient,
      pageSize: 25,
    }, {});
    for await (const page of paginator) {
      taskDefinitionArns.push(...(page.taskDefinitionArns ?? []));
    }
    await Promise.all(taskDefinitionArns.map(async arn => {
      taskDefinitions.push(await this.getTaskDefinition(arn));
      return arn;
    }));
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

  async getTasksArns(cluster: string) {
    const tasksArns: string[] = [];
    const paginator = paginateListTasks({
      client: this.ecsClient,
      pageSize: 25,
    }, {
      cluster,
    });
    for await (const page of paginator) {
      tasksArns.push(...(page.taskArns ?? []));
    }
    return tasksArns;
  }

  async deleteCluster(name: string) {
    const tasks = await this.getTasksArns(name);
    if (tasks.length) {
      await waitUntilTasksStopped({
        client: this.ecsClient,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      }, {
        cluster: name,
        tasks,
      });
    }
    await this.ecsClient.send(
      new DeleteClusterCommand({
        cluster: name,
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
        pageSize: 25,
      }, {
        cluster: id,
      });
      for await (const page of paginator) {
        serviceArns.push(...(page.serviceArns ?? []));
      }
      if (serviceArns.length) {
        const result = await this.ecsClient.send(
          new DescribeServicesCommand({
            cluster: id,
            services: serviceArns
          })
        );
        services.push(...(result.services ?? []));
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

  async deleteService(name: string, cluster: string) {
    await this.ecsClient.send(
      new DeleteServiceCommand({
        service: name,
        cluster,
      })
    )
  }

  async createVpc(input: CreateVpcCommandInput): Promise<Vpc | null> {
    const create = await this.ec2client.send(
      new CreateVpcCommand(input),
    );
    return create?.Vpc ?? null;
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

  async deleteVpc(id: string) {
    await this.ec2client.send(
      new DeleteVpcCommand({ VpcId: id, })
    );
  }

  async createSubnet(input: CreateSubnetCommandInput): Promise<Subnet | null> {
    const create = await this.ec2client.send(
      new CreateSubnetCommand(input),
    );
    return create?.Subnet ?? null;
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

  async getSubnet(id: string) {
    const subnets = await this.ec2client.send(
      new DescribeSubnetsCommand({ SubnetIds: [id], })
    );
    return subnets?.Subnets?.[0];
  }

  async deleteSubnet(id: string) {
    await this.ec2client.send(
      new DeleteSubnetCommand({ SubnetId: id, })
    );
  }

  async createTargetGroup(input: CreateTargetGroupCommandInput): Promise<TargetGroup | null> {
    const create = await this.elbClient.send(
      new CreateTargetGroupCommand(input),
    );
    return create?.TargetGroups?.pop() ?? null;
  }

  async updateTargetGroup(input: ModifyTargetGroupCommandInput): Promise<TargetGroup | null> {
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

  async createLoadBalancer(input: CreateLoadBalancerCommandInput): Promise<LoadBalancer | null> {
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
          throw e;
        }
      },
    );
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
  }

  async createListener(input: CreateListenerCommandInput): Promise<Listener | null> {
    const create = await this.elbClient.send(
      new CreateListenerCommand(input),
    );
    return create?.Listeners?.pop() ?? null;
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
}
