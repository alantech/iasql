import {
  CreateListenerCommandInput,
  CreateLoadBalancerCommandInput,
  DescribeLoadBalancersCommandInput,
  ElasticLoadBalancingV2,
  Listener as ListenerAws,
  LoadBalancer as LoadBalancerAws,
  ModifyListenerCommandInput,
  TargetGroup as TargetGroupAws,
  paginateDescribeListeners,
  paginateDescribeLoadBalancers,
  paginateDescribeTargetGroups,
} from '@aws-sdk/client-elastic-load-balancing-v2';
import {
  EC2,
  paginateDescribeSubnets,
  DescribeNetworkInterfacesCommandInput,
  paginateDescribeVpcs,
} from '@aws-sdk/client-ec2';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder, mapLin } from '../../../services/aws_macros';
import {
  ActionTypeEnum,
  Listener,
  LoadBalancer,
  TargetGroup,
  IpAddressType,
  LoadBalancerSchemeEnum,
  LoadBalancerStateEnum,
  LoadBalancerTypeEnum,
  ProtocolEnum,
  ProtocolVersionEnum,
  TargetGroupIpAddressTypeEnum,
  TargetTypeEnum,
} from './entity';
import { awsVpcModule } from '../aws_vpc';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';
import { awsAcmListModule, awsSecurityGroupModule } from '..';

class ListenerMapper extends MapperBase<Listener> {
  module: AwsElbModule;
  entity = Listener;
  equals = (a: Listener, b: Listener) =>
    Object.is(a.listenerArn, b.listenerArn) &&
    Object.is(a.loadBalancer.loadBalancerArn, b.loadBalancer.loadBalancerArn) &&
    Object.is(a.port, b.port) &&
    Object.is(a.protocol, b.protocol) &&
    Object.is(a.actionType, b.actionType) &&
    Object.is(a.targetGroup.targetGroupArn, b.targetGroup.targetGroupArn) &&
    Object.is(a.sslPolicy, b.sslPolicy) &&
    Object.is(a.certificate?.arn, b.certificate?.arn);

  async listenerMapper(l: ListenerAws, ctx: Context) {
    const out = new Listener();
    if (!l?.LoadBalancerArn || !l?.Port) return undefined;
    out.listenerArn = l?.ListenerArn;
    out.loadBalancer =
      ctx.memo?.db?.LoadBalancer?.[l.LoadBalancerArn] ??
      (await this.module.loadBalancer.db.read(ctx, l?.LoadBalancerArn));
    out.port = l?.Port;
    out.protocol = l?.Protocol as ProtocolEnum;
    for (const a of l?.DefaultActions ?? []) {
      if (a.Type === ActionTypeEnum.FORWARD) {
        out.actionType = a.Type as ActionTypeEnum;
        out.targetGroup =
          (await this.module.targetGroup.db.read(ctx, a?.TargetGroupArn)) ??
          (await this.module.targetGroup.cloud.read(ctx, a?.TargetGroupArn));
        if (!out.targetGroup) return undefined;
      }
    }
    if (l.SslPolicy && l.Certificates?.length) {
      out.sslPolicy = l.SslPolicy;
      const cloudCertificate = l.Certificates.pop();
      out.certificate =
        (await awsAcmListModule.certificate.db.read(ctx, cloudCertificate?.CertificateArn)) ??
        (await awsAcmListModule.certificate.cloud.read(ctx, cloudCertificate?.CertificateArn));
    }
    return out;
  }

  createListener = crudBuilderFormat<ElasticLoadBalancingV2, 'createListener', ListenerAws | undefined>(
    'createListener',
    input => input,
    res => res?.Listeners?.pop(),
  );
  getListener = crudBuilderFormat<ElasticLoadBalancingV2, 'describeListeners', ListenerAws | undefined>(
    'describeListeners',
    arn => ({ ListenerArns: [arn] }),
    res => res?.Listeners?.[0],
  );
  getListenersForArn = paginateBuilder<ElasticLoadBalancingV2>(
    paginateDescribeListeners,
    'Listeners',
    undefined,
    undefined,
    LoadBalancerArn => ({ LoadBalancerArn }),
  );
  getListeners = async (client: ElasticLoadBalancingV2, loadBalancerArns: string[]) =>
    (await mapLin(loadBalancerArns, this.getListenersForArn.bind(null, client))).flat();
  updateListener = crudBuilderFormat<ElasticLoadBalancingV2, 'modifyListener', ListenerAws | undefined>(
    'modifyListener',
    input => input,
    res => res?.Listeners?.pop(),
  );
  deleteListener = crudBuilder2<ElasticLoadBalancingV2, 'deleteListener'>('deleteListener', ListenerArn => ({
    ListenerArn,
  }));

  cloud: Crud2<Listener> = new Crud2({
    create: async (es: Listener[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const listenerInput: CreateListenerCommandInput = {
          Port: e.port,
          Protocol: e.protocol,
          LoadBalancerArn: e.loadBalancer?.loadBalancerArn,
          DefaultActions: [{ Type: e.actionType, TargetGroupArn: e.targetGroup.targetGroupArn }],
        };
        if (e.certificate) {
          listenerInput.SslPolicy = e.sslPolicy ?? 'ELBSecurityPolicy-2016-08';
          listenerInput.Certificates = [
            {
              CertificateArn: e.certificate.arn,
            },
          ];
        }
        const result = await this.createListener(client.elbClient, listenerInput);
        // TODO: Handle if it fails (somehow)
        if (!result?.hasOwnProperty('ListenerArn')) {
          // Failure
          throw new Error('what should we do here?');
        }
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getListener(client.elbClient, result.ListenerArn ?? '');
        if (!newObject) continue;
        // We map this into the same kind of entity as `obj`
        const newEntity = await this.listenerMapper(newObject, ctx);
        if (!newEntity) continue;
        // We attach the original object's ID to this new one, indicating the exact record it is
        // replacing in the database.
        newEntity.id = e.id;
        // Save the record back into the database to get the new fields updated
        await this.module.listener.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawListener = await this.getListener(client.elbClient, id);
        if (!rawListener) return;
        return await this.listenerMapper(rawListener, ctx);
      } else {
        const listeners = await (async () => {
          // TODO: Should this behavior be standard?
          const loadBalancers = ctx.memo?.cloud?.LoadBalancer
            ? Object.values(ctx.memo?.cloud?.LoadBalancer)
            : await this.module.loadBalancer.cloud.read(ctx);
          const loadBalancerArns = loadBalancers.map((lb: any) => lb.loadBalancerArn);
          return await this.getListeners(client.elbClient, loadBalancerArns);
        })();
        const out = [];
        for (const l of listeners) {
          const o = await this.listenerMapper(l, ctx);
          if (o) out.push(o);
        }
        return out;
      }
    },
    updateOrReplace: (prev: Listener, next: Listener) => {
      if (!Object.is(prev.loadBalancer.loadBalancerArn, next.loadBalancer.loadBalancerArn)) {
        return 'replace';
      }
      return 'update';
    },
    update: async (es: Listener[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.Listener?.[e.listenerArn ?? ''];
        const isUpdate = this.module.listener.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          const listenerInput: ModifyListenerCommandInput = {
            ListenerArn: e.listenerArn,
            Port: e.port,
            Protocol: e.protocol,
            DefaultActions: [{ Type: e.actionType, TargetGroupArn: e.targetGroup.targetGroupArn }],
          };
          if (e.certificate) {
            listenerInput.SslPolicy = e.sslPolicy ?? 'ELBSecurityPolicy-2016-08';
            listenerInput.Certificates = [
              {
                CertificateArn: e.certificate.arn,
              },
            ];
          }
          const updatedListener = await this.updateListener(client.elbClient, listenerInput);
          if (!updatedListener) continue;
          const o = await this.listenerMapper(updatedListener, ctx);
          if (o) out.push(o);
        } else {
          // We need to delete the current cloud record and create the new one.
          // The id in database will be the same `e` will keep it.
          await this.module.listener.cloud.delete(cloudRecord, ctx);
          const o = await this.module.listener.cloud.create(e, ctx);
          if (!o) continue;
          if (o instanceof Array) {
            out.push(...o);
          } else {
            out.push(o);
          }
        }
      }
      return out;
    },
    delete: async (es: Listener[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        await this.deleteListener(client.elbClient, e.listenerArn!);
      }
    },
  });

  constructor(module: AwsElbModule) {
    super();
    this.module = module;
    super.init();
  }
}

class LoadBalancerMapper extends MapperBase<LoadBalancer> {
  module: AwsElbModule;
  entity = LoadBalancer;
  equals = (a: LoadBalancer, b: LoadBalancer) =>
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
    (a.securityGroups?.every(asg => !!b.securityGroups?.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false) &&
    Object.is(a.state, b.state) &&
    Object.is(a.subnets?.length, b.subnets?.length) &&
    (a.subnets?.every(asn => !!b.subnets?.find(bsn => Object.is(asn, bsn))) ?? false) &&
    Object.is(a.vpc?.vpcId, b.vpc?.vpcId);

  async loadBalancerMapper(lb: LoadBalancerAws, ctx: Context) {
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
          (await awsSecurityGroupModule.securityGroup.db.read(ctx, sg)) ??
            (await awsSecurityGroupModule.securityGroup.cloud.read(ctx, sg)),
        );
      } catch (_) {
        // If security groups are misconfigured ignore them
        continue;
      }
    }
    out.securityGroups = securityGroups.filter(sg => !!sg);
    out.ipAddressType = lb.IpAddressType as IpAddressType;
    out.customerOwnedIpv4Pool = lb.CustomerOwnedIpv4Pool;
    const vpc = (await awsVpcModule.vpc.db.read(ctx, lb.VpcId)) ?? (await awsVpcModule.vpc.cloud.read(ctx, lb.VpcId));
    out.vpc = vpc;
    out.availabilityZones = lb.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
    out.subnets = lb.AvailabilityZones?.map(az => az.SubnetId ?? '') ?? [];
    return out;
  }

  getSubnets = paginateBuilder<EC2>(paginateDescribeSubnets, 'Subnets');
  getLoadBalancer = crudBuilderFormat<ElasticLoadBalancingV2, 'describeLoadBalancers', LoadBalancerAws | undefined>(
    'describeLoadBalancers',
    arn => ({ LoadBalancerArns: [arn] }),
    res => res?.LoadBalancers?.[0],
  );
  getLoadBalancers = paginateBuilder<ElasticLoadBalancingV2>(paginateDescribeLoadBalancers, 'LoadBalancers');
  updateLoadBalancerIpAddressType = crudBuilder2<ElasticLoadBalancingV2, 'setIpAddressType'>(
    'setIpAddressType',
    input => input,
  );
  updateLoadBalancerSubnets = crudBuilder2<ElasticLoadBalancingV2, 'setSubnets'>('setSubnets', input => input);
  updateLoadBalancerSecurityGroups = crudBuilder2<ElasticLoadBalancingV2, 'setSecurityGroups'>(
    'setSecurityGroups',
    input => input,
  );

  // TODO: Create a waiter macro function
  async createLoadBalancer(client: ElasticLoadBalancingV2, input: CreateLoadBalancerCommandInput) {
    const create = await client.createLoadBalancer(input);
    let loadBalancer = create?.LoadBalancers?.pop() ?? null;
    if (!loadBalancer) return loadBalancer;
    const waiterInput: DescribeLoadBalancersCommandInput = {
      LoadBalancerArns: [loadBalancer?.LoadBalancerArn!],
    };
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

  cloud: Crud2<LoadBalancer> = new Crud2({
    create: async (es: LoadBalancer[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const subnets = (await this.getSubnets(client.ec2client)).map(s => s.SubnetId ?? '');
      const out = [];
      for (const e of es) {
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
        // TODO: Handle if it fails (somehow)
        if (!result?.hasOwnProperty('LoadBalancerArn')) {
          // Failure
          throw new Error('what should we do here?');
        }
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getLoadBalancer(client.elbClient, result.LoadBalancerArn ?? '');
        if (!newObject) continue;
        // We map this into the same kind of entity as `obj`
        const newEntity = await this.loadBalancerMapper(newObject, ctx);
        if (!newEntity) continue;
        // Save the record back into the database to get the new fields updated
        await this.module.loadBalancer.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawLoadBalancer = await this.getLoadBalancer(client.elbClient, id);
        if (!rawLoadBalancer) return;
        return await this.loadBalancerMapper(rawLoadBalancer, ctx);
      } else {
        const lbs = await this.getLoadBalancers(client.elbClient);
        const out = [];
        for (const lb of lbs) {
          const o = await this.loadBalancerMapper(lb, ctx);
          if (o) out.push(o);
        }
        return out;
      }
    },
    updateOrReplace: (prev: LoadBalancer, next: LoadBalancer) => {
      if (
        !(
          Object.is(prev.loadBalancerName, next.loadBalancerName) &&
          Object.is(prev.loadBalancerType, next.loadBalancerType) &&
          Object.is(prev.scheme, next.scheme) &&
          Object.is(prev.vpc?.vpcId, next.vpc?.vpcId)
        )
      ) {
        return 'replace';
      }
      return 'update';
    },
    update: async (es: LoadBalancer[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.LoadBalancer?.[e.loadBalancerArn ?? ''];
        let updatedRecord = { ...cloudRecord };
        const isUpdate = this.module.loadBalancer.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          // Update ip address type
          if (!Object.is(cloudRecord.ipAddressType, e.ipAddressType)) {
            await this.updateLoadBalancerIpAddressType(client.elbClient, {
              LoadBalancerArn: e.loadBalancerArn,
              IpAddressType: e.ipAddressType,
            });
            const updatedLoadBalancer = await this.getLoadBalancer(client.elbClient, e.loadBalancerArn ?? '');
            if (!updatedLoadBalancer) continue;
            updatedRecord = await this.loadBalancerMapper(updatedLoadBalancer, ctx);
          }
          // Update subnets
          if (
            !(
              Object.is(cloudRecord.subnets?.length, e.subnets?.length) &&
              (cloudRecord.subnets?.every((csn: any) => !!e.subnets?.find(esn => Object.is(csn, esn))) ?? false)
            )
          ) {
            await this.updateLoadBalancerSubnets(client.elbClient, {
              LoadBalancerArn: e.loadBalancerArn,
              Subnets: e.subnets?.filter(sn => !!sn),
            });
            const updatedLoadBalancer = await this.getLoadBalancer(client.elbClient, e.loadBalancerArn ?? '');
            if (!updatedLoadBalancer) continue;
            updatedRecord = await this.loadBalancerMapper(updatedLoadBalancer, ctx);
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
            const updatedLoadBalancer = await this.getLoadBalancer(client.elbClient, e.loadBalancerArn ?? '');
            if (!updatedLoadBalancer) continue;
            updatedRecord = await this.loadBalancerMapper(updatedLoadBalancer, ctx);
          }
          await this.module.loadBalancer.db.update(updatedRecord, ctx);
          out.push(updatedRecord);
        } else {
          // We need to delete the current cloud record and create the new one.
          // The id will be the same in database since `e` will keep it.
          await this.module.loadBalancer.cloud.delete(cloudRecord, ctx);
          out.push(await this.module.loadBalancer.cloud.create(e, ctx));
        }
      }
      return out;
    },
    delete: async (es: LoadBalancer[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
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

class TargetGroupMapper extends MapperBase<TargetGroup> {
  module: AwsElbModule;
  entity = TargetGroup;
  equals = (a: TargetGroup, b: TargetGroup) =>
    Object.is(a.targetGroupArn, b.targetGroupArn) &&
    Object.is(a.targetGroupName, b.targetGroupName) &&
    Object.is(a.targetType, b.targetType) &&
    Object.is(a.ipAddressType, b.ipAddressType) &&
    Object.is(a.protocol, b.protocol) &&
    Object.is(a.port, b.port) &&
    Object.is(a.vpc?.vpcId, b.vpc?.vpcId) &&
    Object.is(a.protocolVersion, b.protocolVersion) &&
    Object.is(a.healthCheckProtocol, b.healthCheckProtocol) &&
    Object.is(a.healthCheckPort, b.healthCheckPort) &&
    Object.is(a.healthCheckPath, b.healthCheckPath) &&
    Object.is(a.healthCheckEnabled, b.healthCheckEnabled) &&
    Object.is(a.healthCheckIntervalSeconds, b.healthCheckIntervalSeconds) &&
    Object.is(a.healthCheckTimeoutSeconds, b.healthCheckTimeoutSeconds) &&
    Object.is(a.healthyThresholdCount, b.healthyThresholdCount) &&
    Object.is(a.unhealthyThresholdCount, b.unhealthyThresholdCount);

  async targetGroupMapper(tg: any, ctx: Context) {
    const out = new TargetGroup();
    if (!tg?.TargetGroupName) return undefined;
    out.targetGroupName = tg.TargetGroupName;
    out.targetType = tg.TargetType as TargetTypeEnum;
    out.targetGroupArn = tg.TargetGroupArn;
    out.ipAddressType = tg.IpAddressType as TargetGroupIpAddressTypeEnum;
    out.protocol = tg.Protocol as ProtocolEnum;
    out.port = tg.Port;
    out.healthCheckProtocol = tg.HealthCheckProtocol as ProtocolEnum;
    out.healthCheckPort = tg.HealthCheckPort;
    out.healthCheckEnabled = tg.HealthCheckEnabled;
    out.healthCheckIntervalSeconds = tg.HealthCheckIntervalSeconds;
    out.healthCheckTimeoutSeconds = tg.HealthCheckTimeoutSeconds;
    out.healthyThresholdCount = tg.HealthyThresholdCount;
    out.unhealthyThresholdCount = tg.UnhealthyThresholdCount;
    out.healthCheckPath = tg.HealthCheckPath;
    out.protocolVersion = tg.ProtocolVersion as ProtocolVersionEnum;
    try {
      const vpc = (await awsVpcModule.vpc.db.read(ctx, tg.VpcId)) ?? (await awsVpcModule.vpc.cloud.read(ctx, tg.VpcId));
      if (tg.VpcId && !vpc) return undefined;
      out.vpc = vpc;
    } catch (e: any) {
      if (e.Code === 'InvalidVpcID.NotFound') return undefined;
    }
    return out;
  }

  getVpcs = paginateBuilder<EC2>(paginateDescribeVpcs, 'Vpcs');
  createTargetGroup = crudBuilderFormat<ElasticLoadBalancingV2, 'createTargetGroup', TargetGroupAws | undefined>(
    'createTargetGroup',
    input => input,
    res => res?.TargetGroups?.pop(),
  );
  getTargetGroup = crudBuilderFormat<ElasticLoadBalancingV2, 'describeTargetGroups', TargetGroupAws | undefined>(
    'describeTargetGroups',
    arn => ({ TargetGroupArns: [arn] }),
    res => res?.TargetGroups?.[0],
  );
  getTargetGroups = paginateBuilder<ElasticLoadBalancingV2>(paginateDescribeTargetGroups, 'TargetGroups');
  updateTargetGroup = crudBuilderFormat<ElasticLoadBalancingV2, 'modifyTargetGroup', TargetGroupAws | undefined>(
    'modifyTargetGroup',
    input => input,
    res => res?.TargetGroups?.pop(),
  );
  deleteTargetGroup = crudBuilder2<ElasticLoadBalancingV2, 'deleteTargetGroup'>(
    'deleteTargetGroup',
    TargetGroupArn => ({ TargetGroupArn }),
  );

  cloud: Crud2<TargetGroup> = new Crud2({
    create: async (es: TargetGroup[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const vpcs = await this.getVpcs(client.ec2client);
      const defaultVpc = vpcs.find(vpc => vpc.IsDefault === true) ?? {};
      const out = [];
      for (const e of es) {
        const result = await this.createTargetGroup(client.elbClient, {
          Name: e.targetGroupName,
          TargetType: e.targetType,
          Port: e.port,
          VpcId: !e.vpc ? defaultVpc.VpcId ?? '' : e.vpc.vpcId ?? '',
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
        // TODO: Handle if it fails (somehow)
        if (!result?.hasOwnProperty('TargetGroupArn')) {
          // Failure
          throw new Error('what should we do here?');
        }
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getTargetGroup(client.elbClient, result.TargetGroupArn ?? '');
        // We map this into the same kind of entity as `obj`
        const newEntity = await this.targetGroupMapper(newObject, ctx);
        if (!newEntity) continue;
        // Save the record back into the database to get the new fields updated
        await this.module.targetGroup.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawTargetGroup = await this.getTargetGroup(client.elbClient, id);
        if (!rawTargetGroup) return;
        return await this.targetGroupMapper(rawTargetGroup, ctx);
      } else {
        const tgs = await this.getTargetGroups(client.elbClient);
        const out = [];
        for (const tg of tgs) {
          const tgMapped = await this.targetGroupMapper(tg, ctx);
          if (tgMapped) out.push(tgMapped);
        }
        return out;
      }
    },
    updateOrReplace: (prev: TargetGroup, next: TargetGroup) => {
      if (
        !(
          Object.is(prev.targetGroupName, next.targetGroupName) &&
          Object.is(prev.targetType, next.targetType) &&
          Object.is(prev.vpc?.vpcId, next.vpc?.vpcId) &&
          Object.is(prev.port, next.port) &&
          Object.is(prev.protocol, next.protocol) &&
          Object.is(prev.ipAddressType, next.ipAddressType) &&
          Object.is(prev.protocolVersion, next.protocolVersion)
        )
      ) {
        return 'replace';
      }
      return 'update';
    },
    update: async (es: TargetGroup[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.TargetGroup?.[e.targetGroupArn ?? ''] as TargetGroup;
        // Short-circuit if it's just a default VPC vs no-VPC difference
        if (cloudRecord.vpc?.isDefault && !e.vpc) {
          const o = await this.module.targetGroup.db.update(cloudRecord, ctx);
          if (!o) continue;
          if (o instanceof TargetGroup) {
            out.push(o);
          } else {
            out.push(...o);
          }
        }
        const isUpdate = this.module.targetGroup.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          const updatedTargetGroup = await this.updateTargetGroup(client.elbClient, {
            TargetGroupArn: e.targetGroupArn,
            // TODO: make this properties not nullable but with default values
            HealthCheckProtocol: e.healthCheckProtocol, // TODO: this one defaults to protocol
            HealthCheckPort: e.healthCheckPort,
            HealthCheckPath: e.healthCheckPath, // TODO: EXCEPT THIS ONE
            HealthCheckEnabled: e.healthCheckEnabled,
            HealthCheckIntervalSeconds: e.healthCheckIntervalSeconds,
            HealthCheckTimeoutSeconds: e.healthCheckTimeoutSeconds,
            HealthyThresholdCount: e.healthyThresholdCount,
            UnhealthyThresholdCount: e.unhealthyThresholdCount,
          });
          const o = await this.targetGroupMapper(updatedTargetGroup, ctx);
          if (!o) continue;
          if (o instanceof Array) {
            out.push(...o);
          } else {
            out.push(o);
          }
        } else {
          // We need to delete the current cloud record and create the new one.
          // The id will be the same in database since `e` will keep it.
          // TODO: what to do when a load balancer depends on the target group??
          await this.module.targetGroup.cloud.delete(cloudRecord, ctx);
          out.push(await this.module.targetGroup.cloud.create(e, ctx));
        }
      }
      return out;
    },
    delete: async (es: TargetGroup[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        await this.deleteTargetGroup(client.elbClient, e.targetGroupArn!);
      }
    },
  });

  constructor(module: AwsElbModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsElbModule extends ModuleBase {
  listener: ListenerMapper;
  loadBalancer: LoadBalancerMapper;
  targetGroup: TargetGroupMapper;

  constructor() {
    super();
    this.listener = new ListenerMapper(this);
    this.loadBalancer = new LoadBalancerMapper(this);
    this.targetGroup = new TargetGroupMapper(this);
    super.init();
  }
}
export const awsElbModule = new AwsElbModule();
