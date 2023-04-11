import { DescribeNetworkInterfacesCommandInput, EC2, paginateDescribeSubnets } from '@aws-sdk/client-ec2';
import {
  CreateLoadBalancerCommandInput,
  DescribeLoadBalancersCommandInput,
  ElasticLoadBalancingV2,
  LoadBalancer as LoadBalancerAws,
  LoadBalancerAttribute,
  paginateDescribeLoadBalancers,
} from '@aws-sdk/client-elastic-load-balancing-v2';
import { parse as parseArn } from '@aws-sdk/util-arn-parser';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AwsElbModule } from '..';
import { AWS, crudBuilder, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { awsSecurityGroupModule } from '../../aws_security_group';
import { awsVpcModule } from '../../aws_vpc';
import { Subnet } from '../../aws_vpc/entity';
import { Context, Crud, MapperBase } from '../../interfaces';
import {
  IpAddressType,
  LoadBalancer,
  LoadBalancerSchemeEnum,
  LoadBalancerStateEnum,
  LoadBalancerTypeEnum,
} from '../entity';

export class LoadBalancerMapper extends MapperBase<LoadBalancer> {
  module: AwsElbModule;
  entity = LoadBalancer;
  equals = (a: LoadBalancer, b: LoadBalancer) => {
    return (
      Object.is(a.availabilityZones?.length, b.availabilityZones?.length) &&
      (a.availabilityZones
        ?.filter(aaz => !!aaz)
        .every(aaz => !!b.availabilityZones?.filter(baz => !!baz).find(baz => Object.is(aaz, baz))) ??
        false) &&
      Object.is(a.canonicalHostedZoneId, b.canonicalHostedZoneId) &&
      Object.is(a.createdTime?.getTime(), b.createdTime?.getTime()) &&
      // This property might be comparing null vs undefined
      // tslint:disable-next-line: triple-equals
      a.customerOwnedIpv4Pool == b.customerOwnedIpv4Pool &&
      Object.is(a.dnsName, b.dnsName) &&
      Object.is(a.ipAddressType, b.ipAddressType) &&
      Object.is(a.loadBalancerName, b.loadBalancerName) &&
      Object.is(a.loadBalancerType, b.loadBalancerType) &&
      Object.is(a.scheme, b.scheme) &&
      Object.is(a.securityGroups?.length, b.securityGroups?.length) &&
      (a.securityGroups?.every(asg => !!b.securityGroups?.find(bsg => Object.is(asg.groupId, bsg.groupId))) ??
        false) &&
      Object.is(a.state, b.state) &&
      Object.is(a.subnets?.length, b.subnets?.length) &&
      (a.subnets?.every(asn => !!b.subnets?.find(bsn => Object.is(asn, bsn))) ?? false) &&
      Object.is(a.vpc?.vpcId, b.vpc?.vpcId) &&
      Object.is(a.region, b.region) &&
      Object.is(a.attributes?.length, b.attributes?.length) &&
      (a.attributes?.every(
        aatt =>
          !!b.attributes?.find(batt => Object.is(aatt.Key, batt.Key) && Object.is(aatt.Value, batt.Value)),
      ) ??
        false)
    );
  };

  async loadBalancerMapper(lb: LoadBalancerAws, ctx: Context, region: string) {
    const out = new LoadBalancer();
    if (!lb?.LoadBalancerName || !lb?.Scheme || !lb?.Type || !lb?.IpAddressType || !lb.VpcId) {
      return undefined;
    }
    out.loadBalancerName = lb.LoadBalancerName;
    out.loadBalancerArn = lb.LoadBalancerArn;
    out.dnsName = lb.DNSName;
    out.canonicalHostedZoneId = lb.CanonicalHostedZoneId;
    out.createdTime = lb.CreatedTime ? new Date(lb.CreatedTime) : lb.CreatedTime;
    out.scheme = lb.Scheme as LoadBalancerSchemeEnum;
    out.state = lb.State?.Code as LoadBalancerStateEnum;
    out.loadBalancerType = lb.Type as LoadBalancerTypeEnum;
    const securityGroups = [];
    const cloudSecurityGroups = lb.SecurityGroups ?? [];
    for (const sg of cloudSecurityGroups) {
      try {
        securityGroups.push(
          (await awsSecurityGroupModule.securityGroup.db.read(
            ctx,
            awsSecurityGroupModule.securityGroup.generateId({ groupId: sg, region }),
          )) ??
            (await awsSecurityGroupModule.securityGroup.cloud.read(
              ctx,
              awsSecurityGroupModule.securityGroup.generateId({ groupId: sg, region }),
            )),
        );
      } catch (_) {
        // If security groups are misconfigured ignore them
        continue;
      }
    }
    out.securityGroups = securityGroups.filter(sg => !!sg);
    out.ipAddressType = lb.IpAddressType as IpAddressType;
    out.customerOwnedIpv4Pool = lb.CustomerOwnedIpv4Pool;
    const vpc =
      (await awsVpcModule.vpc.db.read(ctx, awsVpcModule.vpc.generateId({ vpcId: lb.VpcId, region }))) ??
      (await awsVpcModule.vpc.cloud.read(ctx, awsVpcModule.vpc.generateId({ vpcId: lb.VpcId, region })));
    out.vpc = vpc;
    out.availabilityZones = lb.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
    out.subnets = lb.AvailabilityZones?.map(az => az.SubnetId ?? '') ?? [];
    out.region = region;

    // retrieve attributes
    const client = (await ctx.getAwsClient(region)) as AWS;
    const attributes = await this.getLoadBalancerAttributes(client.elbClient, out.loadBalancerArn ?? '');
    if (attributes) out.attributes = attributes;

    return out;
  }

  getSubnets = paginateBuilder<EC2>(paginateDescribeSubnets, 'Subnets');
  getLoadBalancer = crudBuilderFormat<
    ElasticLoadBalancingV2,
    'describeLoadBalancers',
    LoadBalancerAws | undefined
  >(
    'describeLoadBalancers',
    arn => ({ LoadBalancerArns: [arn] }),
    res => res?.LoadBalancers?.[0],
  );
  getLoadBalancerAttributes = crudBuilderFormat<
    ElasticLoadBalancingV2,
    'describeLoadBalancerAttributes',
    LoadBalancerAttribute[] | undefined
  >(
    'describeLoadBalancerAttributes',
    arn => ({ LoadBalancerArn: arn }),
    res => res?.Attributes,
  );

  getLoadBalancers = paginateBuilder<ElasticLoadBalancingV2>(paginateDescribeLoadBalancers, 'LoadBalancers');
  updateLoadBalancerIpAddressType = crudBuilder<ElasticLoadBalancingV2, 'setIpAddressType'>(
    'setIpAddressType',
    input => input,
  );
  updateLoadBalancerSubnets = crudBuilder<ElasticLoadBalancingV2, 'setSubnets'>('setSubnets', input => input);
  updateLoadBalancerSecurityGroups = crudBuilder<ElasticLoadBalancingV2, 'setSecurityGroups'>(
    'setSecurityGroups',
    input => input,
  );
  modifyLoadBalancerAttributes = crudBuilder<ElasticLoadBalancingV2, 'modifyLoadBalancerAttributes'>(
    'modifyLoadBalancerAttributes',
    input => input,
  );

  // TODO: Create a waiter macro function
  async createLoadBalancer(client: ElasticLoadBalancingV2, input: CreateLoadBalancerCommandInput) {
    const create = await client.createLoadBalancer(input);
    const loadBalancer = create?.LoadBalancers?.pop() ?? null;
    if (!loadBalancer) return undefined;
    const waiterInput: DescribeLoadBalancersCommandInput = {
      LoadBalancerArns: [loadBalancer?.LoadBalancerArn!],
    };

    let newLoadBalancer: LoadBalancerAws | undefined;
    // TODO: should we use the paginator instead?
    await createWaiter<ElasticLoadBalancingV2, DescribeLoadBalancersCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 600,
        minDelay: 1,
        maxDelay: 4,
      },
      waiterInput,
      async (cl, cmd) => {
        try {
          const data = await cl.describeLoadBalancers(cmd);
          for (const lb of data?.LoadBalancers ?? []) {
            if (lb.State?.Code !== 'active') return { state: WaiterState.RETRY };
            newLoadBalancer = lb;
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          return { state: WaiterState.RETRY };
        }
      },
    );

    return newLoadBalancer ?? undefined;
  }

  // TODO: Really refactor the client access in this thing later
  async deleteLoadBalancer(client: { elbClient: ElasticLoadBalancingV2; ec2client: EC2 }, arn: string) {
    await client.elbClient.deleteLoadBalancer({ LoadBalancerArn: arn });
    // We wait it is completely deleted to avoid issues deleting dependent resources.
    const input: DescribeLoadBalancersCommandInput = { LoadBalancerArns: [arn] };
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
          Values: [`*${loadBalancerName}`],
        },
      ],
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

  cloud: Crud<LoadBalancer> = new Crud({
    create: async (es: LoadBalancer[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const subnets =
          (await awsVpcModule.subnet.cloud.read(ctx))
            ?.filter((s: Subnet) => !!s)
            .filter((s: Subnet) => s.region === e.region && s.vpc.isDefault)
            .filter((s: Subnet) => {
              if (e.availabilityZones?.length) {
                return e.availabilityZones.includes(s.availabilityZone.name);
              }
              return true;
            })
            .map((s: Subnet) => s.subnetId ?? '') ?? [];

        const securityGroups = e.securityGroups?.map(sg => {
          if (!sg.groupId) throw new Error('Security group need to be loaded first');
          return sg.groupId;
        });
        const input: CreateLoadBalancerCommandInput = {
          Name: e.loadBalancerName,
          Subnets: e.subnets && e.subnets.length && e.subnets.every(s => !!s) ? e.subnets : subnets,
          Scheme: e.scheme,
          Type: e.loadBalancerType,
          IpAddressType: e.ipAddressType,
          CustomerOwnedIpv4Pool: e.customerOwnedIpv4Pool,
        };
        if (e.loadBalancerType === LoadBalancerTypeEnum.APPLICATION) {
          input.SecurityGroups = securityGroups;
        }
        const result = await this.createLoadBalancer(client.elbClient, input);
        if (result) {
          // TODO: Handle if it fails (somehow)
          if (!result?.hasOwnProperty('LoadBalancerArn')) {
            // Failure
            throw new Error('what should we do here?');
          }
          // Re-get the inserted record to get all of the relevant records we care about
          const newObject = await this.getLoadBalancer(client.elbClient, result.LoadBalancerArn ?? '');
          if (!newObject) continue;

          // We map this into the same kind of entity as `obj`
          const newEntity = await this.loadBalancerMapper(newObject, ctx, e.region);
          if (!newEntity) continue;
          newEntity.id = e.id;

          // Save the record back into the database to get the new fields updated
          await this.module.loadBalancer.db.update(newEntity, ctx);
          out.push(newEntity);
        }
      }
      return out;
    },
    read: async (ctx: Context, arn?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (arn) {
        const region = parseArn(arn).region;
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawLoadBalancer = await this.getLoadBalancer(client.elbClient, arn);
          if (!rawLoadBalancer) return;
          return await this.loadBalancerMapper(rawLoadBalancer, ctx, region);
        }
      } else {
        const out: LoadBalancer[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const lbs = await this.getLoadBalancers(client.elbClient);
            for (const lb of lbs) {
              const o = await this.loadBalancerMapper(lb, ctx, region);
              if (o) out.push(o);
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: (prev: LoadBalancer, next: LoadBalancer) => {
      if (
        !(
          Object.is(prev.loadBalancerName, next.loadBalancerName) &&
          Object.is(prev.loadBalancerType, next.loadBalancerType) &&
          Object.is(prev.scheme, next.scheme) &&
          Object.is(prev.vpc?.vpcId, next.vpc?.vpcId) &&
          Object.is(prev.region, next.region)
        )
      ) {
        return 'replace';
      }
      return 'update';
    },
    update: async (es: LoadBalancer[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;

        const cloudRecord = ctx?.memo?.cloud?.LoadBalancer?.[e.loadBalancerArn ?? ''];
        let updatedRecord = { ...cloudRecord };
        const isUpdate = this.module.loadBalancer.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          let needsRefresh: boolean = false;

          // Update ip address type
          if (!Object.is(cloudRecord.ipAddressType, e.ipAddressType)) {
            await this.updateLoadBalancerIpAddressType(client.elbClient, {
              LoadBalancerArn: e.loadBalancerArn,
              IpAddressType: e.ipAddressType,
            });
            needsRefresh = true;
          }
          // Update subnets
          if (
            !(
              Object.is(cloudRecord.subnets?.length, e.subnets?.length) &&
              (cloudRecord.subnets?.every((csn: any) => !!e.subnets?.find(esn => Object.is(csn, esn))) ??
                false)
            )
          ) {
            await this.updateLoadBalancerSubnets(client.elbClient, {
              LoadBalancerArn: e.loadBalancerArn,
              Subnets: e.subnets?.filter(sn => !!sn),
            });
            needsRefresh = true;
          }
          // Update security groups
          if (
            !(
              Object.is(cloudRecord.securityGroups?.length, e.securityGroups?.length) &&
              (cloudRecord.securityGroups?.every(
                (csg: any) => !!e.securityGroups?.find(esg => Object.is(csg.groupId, esg.groupId)),
              ) ??
                false)
            )
          ) {
            await this.updateLoadBalancerSecurityGroups(client.elbClient, {
              LoadBalancerArn: e.loadBalancerArn,
              SecurityGroups: e.securityGroups?.filter(sg => !!sg.groupId).map(sg => sg.groupId!),
            });
            needsRefresh = true;
          }

          // Update attributes
          if (
            !(
              Object.is(cloudRecord.attributes?.length, e.attributes?.length) &&
              (cloudRecord.attributes?.every(
                (aatt: any) =>
                  !!e.attributes?.find(
                    batt => Object.is(aatt.Key, batt.Key) && Object.is(aatt.Value, batt.Value),
                  ),
              ) ??
                false)
            )
          ) {
            await this.modifyLoadBalancerAttributes(client.elbClient, {
              LoadBalancerArn: e.loadBalancerArn,
              Attributes: e.attributes?.filter(att => !!att),
            });
            needsRefresh = true;
          }

          if (needsRefresh) {
            const updatedLoadBalancer = await this.getLoadBalancer(client.elbClient, e.loadBalancerArn ?? '');
            if (!updatedLoadBalancer) continue;
            updatedRecord = await this.loadBalancerMapper(updatedLoadBalancer, ctx, e.region);
            if (updatedRecord) {
              updatedRecord.id = e.id;
              await this.module.loadBalancer.db.update(updatedRecord, ctx);
              out.push(updatedRecord);
            }
          } else {
            // we just restore the cloud record
            cloudRecord.id = e.id;
            await this.module.loadBalancer.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          }
        } else {
          // We need to delete the current cloud record and create the new one.
          // The id will be the same in database since `e` will keep it.
          await this.module.loadBalancer.cloud.delete(cloudRecord, ctx);
          let newRecord = await this.module.loadBalancer.cloud.create(e, ctx);
          if (newRecord && !Array.isArray(newRecord)) {
            if (
              !(
                Object.is(newRecord.attributes?.length, e.attributes?.length) &&
                (newRecord.attributes?.every(
                  (aatt: any) =>
                    !!e.attributes?.find(
                      batt => Object.is(aatt.Key, batt.Key) && Object.is(aatt.Value, batt.Value),
                    ),
                ) ??
                  false)
              )
            ) {
              // Attributes are not returned by the create call, so we need to update them
              await this.modifyLoadBalancerAttributes(client.elbClient, {
                LoadBalancerArn: newRecord.loadBalancerArn,
                Attributes: e.attributes?.filter(att => !!att),
              });
              newRecord = await this.cloud.read(ctx, newRecord.loadBalancerArn);
              if (!newRecord) continue;
              await this.module.loadBalancer.db.update(newRecord, ctx);
            }
            out.push(newRecord);
          }
        }
      }
      return out;
    },
    delete: async (es: LoadBalancer[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.deleteLoadBalancer({ ...client }, e.loadBalancerArn!);
      }
    },
  });

  constructor(module: AwsElbModule) {
    super();
    this.module = module;
    super.init();
  }
}
