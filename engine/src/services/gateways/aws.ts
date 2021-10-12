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
} from '@aws-sdk/client-ec2'
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
} from '@aws-sdk/client-rds'
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter'
import { inspect } from 'util'

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
  private rdsClient: RDSClient
  private credentials: AWSCreds

  constructor(config: AWSConfig) {
    console.log(config);
    this.credentials = config.credentials;
    this.ec2client = new EC2Client(config);
    this.rdsClient = new RDSClient(config);
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

  async getAvailabilityZoneByName(azName: string) {
    return (await this.ec2client.send(new DescribeAvailabilityZonesCommand({
      ZoneNames: [ azName ],
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

  async createDBInstance(instanceParams: CreateDBInstanceCommandInput) {
    return await this.rdsClient.send(
      new CreateDBInstanceCommand(instanceParams),
    );
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
    const orderableInstanceOptions = [];
    for (const engine of engines) {
      console.log('Getting for engine', engine);
      const paginator = paginateDescribeOrderableDBInstanceOptions({
        client: this.rdsClient,
        pageSize: 100,
      }, { Engine: engine, });
      for await (const page of paginator) {
        orderableInstanceOptions.push(...(page.OrderableDBInstanceOptions ?? []));
      }
    }
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
      DBEngineVersions: engines, // Make it "look like" the regular query again
    };
  }

  async getEngineVersion(version: string) {
    return (await this.rdsClient.send(new DescribeDBEngineVersionsCommand({
      EngineVersion: version,
    })))?.DBEngineVersions?.[0];
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

}
