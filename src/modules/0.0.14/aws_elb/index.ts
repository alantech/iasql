import {
  EC2,
  paginateDescribeSubnets,
  DescribeNetworkInterfacesCommandInput,
  paginateDescribeVpcs,
} from '@aws-sdk/client-ec2';
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
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AwsAcmListModule, AwsSecurityGroupModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder, mapLin } from '../../../services/aws_macros';
import { Context, Crud2, Mapper2, Module2 } from '../../interfaces';
import { AwsVpcModule } from '../aws_vpc';
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
import * as metadata from './module.json';

const createListener = crudBuilderFormat<ElasticLoadBalancingV2, 'createListener', ListenerAws | undefined>(
  'createListener',
  input => input,
  res => res?.Listeners?.pop(),
);
const getListener = crudBuilderFormat<ElasticLoadBalancingV2, 'describeListeners', ListenerAws | undefined>(
  'describeListeners',
  arn => ({ ListenerArns: [arn] }),
  res => res?.Listeners?.[0],
);
const getListenersForArn = paginateBuilder<ElasticLoadBalancingV2>(
  paginateDescribeListeners,
  'Listeners',
  undefined,
  undefined,
  LoadBalancerArn => ({ LoadBalancerArn }),
);
const getListeners = async (client: ElasticLoadBalancingV2, loadBalancerArns: string[]) =>
  (await mapLin(loadBalancerArns, getListenersForArn.bind(null, client))).flat();
const updateListener = crudBuilderFormat<ElasticLoadBalancingV2, 'modifyListener', ListenerAws | undefined>(
  'modifyListener',
  input => input,
  res => res?.Listeners?.pop(),
);
const deleteListener = crudBuilder2<ElasticLoadBalancingV2, 'deleteListener'>(
  'deleteListener',
  ListenerArn => ({
    ListenerArn,
  }),
);
const getSubnets = paginateBuilder<EC2>(paginateDescribeSubnets, 'Subnets');
const getLoadBalancer = crudBuilderFormat<
  ElasticLoadBalancingV2,
  'describeLoadBalancers',
  LoadBalancerAws | undefined
>(
  'describeLoadBalancers',
  arn => ({ LoadBalancerArns: [arn] }),
  res => res?.LoadBalancers?.[0],
);
const getLoadBalancers = paginateBuilder<ElasticLoadBalancingV2>(
  paginateDescribeLoadBalancers,
  'LoadBalancers',
);
const updateLoadBalancerIpAddressType = crudBuilder2<ElasticLoadBalancingV2, 'setIpAddressType'>(
  'setIpAddressType',
  input => input,
);
const updateLoadBalancerSubnets = crudBuilder2<ElasticLoadBalancingV2, 'setSubnets'>(
  'setSubnets',
  input => input,
);
const updateLoadBalancerSecurityGroups = crudBuilder2<ElasticLoadBalancingV2, 'setSecurityGroups'>(
  'setSecurityGroups',
  input => input,
);
const getVpcs = paginateBuilder<EC2>(paginateDescribeVpcs, 'Vpcs');
const createTargetGroup = crudBuilderFormat<
  ElasticLoadBalancingV2,
  'createTargetGroup',
  TargetGroupAws | undefined
>(
  'createTargetGroup',
  input => input,
  res => res?.TargetGroups?.pop(),
);
const getTargetGroup = crudBuilderFormat<
  ElasticLoadBalancingV2,
  'describeTargetGroups',
  TargetGroupAws | undefined
>(
  'describeTargetGroups',
  arn => ({ TargetGroupArns: [arn] }),
  res => res?.TargetGroups?.[0],
);
const getTargetGroups = paginateBuilder<ElasticLoadBalancingV2>(paginateDescribeTargetGroups, 'TargetGroups');
const updateTargetGroup = crudBuilderFormat<
  ElasticLoadBalancingV2,
  'modifyTargetGroup',
  TargetGroupAws | undefined
>(
  'modifyTargetGroup',
  input => input,
  res => res?.TargetGroups?.pop(),
);
const deleteTargetGroup = crudBuilder2<ElasticLoadBalancingV2, 'deleteTargetGroup'>(
  'deleteTargetGroup',
  TargetGroupArn => ({ TargetGroupArn }),
);

// TODO: Create a waiter macro function
async function createLoadBalancer(client: ElasticLoadBalancingV2, input: CreateLoadBalancerCommandInput) {
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
async function deleteLoadBalancer(
  client: { elbClient: ElasticLoadBalancingV2; ec2client: EC2 },
  arn: string,
) {
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

export const AwsElbModule: Module2 = new Module2(
  {
    ...metadata,
    utils: {
      listenerMapper: async (l: ListenerAws, ctx: Context) => {
        const out = new Listener();
        if (!l?.LoadBalancerArn || !l?.Port) return undefined;
        out.listenerArn = l?.ListenerArn;
        out.loadBalancer =
          ctx.memo?.db?.LoadBalancer?.[l.LoadBalancerArn] ??
          (await AwsElbModule.mappers.loadBalancer.db.read(ctx, l?.LoadBalancerArn));
        out.port = l?.Port;
        out.protocol = l?.Protocol as ProtocolEnum;
        for (const a of l?.DefaultActions ?? []) {
          if (a.Type === ActionTypeEnum.FORWARD) {
            out.actionType = a.Type as ActionTypeEnum;
            out.targetGroup =
              (await AwsElbModule.mappers.targetGroup.db.read(ctx, a?.TargetGroupArn)) ??
              (await AwsElbModule.mappers.targetGroup.cloud.read(ctx, a?.TargetGroupArn));
            if (!out.targetGroup) return undefined;
          }
        }
        if (l.SslPolicy && l.Certificates?.length) {
          out.sslPolicy = l.SslPolicy;
          const cloudCertificate = l.Certificates.pop();
          out.certificate =
            (await AwsAcmListModule.mappers.certificate.db.read(ctx, cloudCertificate?.CertificateArn)) ??
            (await AwsAcmListModule.mappers.certificate.cloud.read(ctx, cloudCertificate?.CertificateArn));
        }
        return out;
      },
      loadBalancerMapper: async (lb: LoadBalancerAws, ctx: Context) => {
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
              (await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sg)) ??
                (await AwsSecurityGroupModule.mappers.securityGroup.cloud.read(ctx, sg)),
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
          (await AwsVpcModule.mappers.vpc.db.read(ctx, lb.VpcId)) ??
          (await AwsVpcModule.mappers.vpc.cloud.read(ctx, lb.VpcId));
        out.vpc = vpc;
        out.availabilityZones = lb.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
        out.subnets = lb.AvailabilityZones?.map(az => az.SubnetId ?? '') ?? [];
        return out;
      },
      targetGroupMapper: async (tg: any, ctx: Context) => {
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
          const vpc =
            (await AwsVpcModule.mappers.vpc.db.read(ctx, tg.VpcId)) ??
            (await AwsVpcModule.mappers.vpc.cloud.read(ctx, tg.VpcId));
          if (tg.VpcId && !vpc) return undefined;
          out.vpc = vpc;
        } catch (e: any) {
          if (e.Code === 'InvalidVpcID.NotFound') return undefined;
        }
        return out;
      },
    },
    mappers: {
      listener: new Mapper2<Listener>({
        entity: Listener,
        equals: (a: Listener, b: Listener) =>
          Object.is(a.listenerArn, b.listenerArn) &&
          Object.is(a.loadBalancer.loadBalancerArn, b.loadBalancer.loadBalancerArn) &&
          Object.is(a.port, b.port) &&
          Object.is(a.protocol, b.protocol) &&
          Object.is(a.actionType, b.actionType) &&
          Object.is(a.targetGroup.targetGroupArn, b.targetGroup.targetGroupArn) &&
          Object.is(a.sslPolicy, b.sslPolicy) &&
          Object.is(a.certificate?.arn, b.certificate?.arn),
        source: 'db',
        cloud: new Crud2({
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
              const result = await createListener(client.elbClient, listenerInput);
              // TODO: Handle if it fails (somehow)
              if (!result?.hasOwnProperty('ListenerArn')) {
                // Failure
                throw new Error('what should we do here?');
              }
              // Re-get the inserted record to get all of the relevant records we care about
              const newObject = await getListener(client.elbClient, result.ListenerArn ?? '');
              // We map this into the same kind of entity as `obj`
              const newEntity = await AwsElbModule.utils.listenerMapper(newObject, ctx);
              // We attach the original object's ID to this new one, indicating the exact record it is
              // replacing in the database.
              newEntity.id = e.id;
              // Save the record back into the database to get the new fields updated
              await AwsElbModule.mappers.listener.db.update(newEntity, ctx);
              out.push(newEntity);
            }
            return out;
          },
          read: async (ctx: Context, id?: string) => {
            const client = (await ctx.getAwsClient()) as AWS;
            if (id) {
              const rawListener = await getListener(client.elbClient, id);
              if (!rawListener) return;
              return await AwsElbModule.utils.listenerMapper(rawListener, ctx);
            } else {
              const listeners = await (async () => {
                // TODO: Should this behavior be standard?
                const loadBalancers = ctx.memo?.cloud?.LoadBalancer
                  ? Object.values(ctx.memo?.cloud?.LoadBalancer)
                  : await AwsElbModule.mappers.loadBalancer.cloud.read(ctx);
                const loadBalancerArns = loadBalancers.map((lb: any) => lb.loadBalancerArn);
                return await getListeners(client.elbClient, loadBalancerArns);
              })();
              const out = [];
              for (const l of listeners) {
                out.push(await AwsElbModule.utils.listenerMapper(l, ctx));
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
              const isUpdate =
                AwsElbModule.mappers.listener.cloud.updateOrReplace(cloudRecord, e) === 'update';
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
                const updatedListener = await updateListener(client.elbClient, listenerInput);
                out.push(AwsElbModule.utils.listenerMapper(updatedListener, ctx));
              } else {
                // We need to delete the current cloud record and create the new one.
                // The id in database will be the same `e` will keep it.
                await AwsElbModule.mappers.listener.cloud.delete(cloudRecord, ctx);
                out.push(await AwsElbModule.mappers.listener.cloud.create(e, ctx));
              }
            }
            return out;
          },
          delete: async (es: Listener[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const e of es) {
              await deleteListener(client.elbClient, e.listenerArn!);
            }
          },
        }),
      }),
      loadBalancer: new Mapper2<LoadBalancer>({
        entity: LoadBalancer,
        equals: (a: LoadBalancer, b: LoadBalancer) =>
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
          (a.securityGroups?.every(
            asg => !!b.securityGroups?.find(bsg => Object.is(asg.groupId, bsg.groupId)),
          ) ??
            false) &&
          Object.is(a.state, b.state) &&
          Object.is(a.subnets?.length, b.subnets?.length) &&
          (a.subnets?.every(asn => !!b.subnets?.find(bsn => Object.is(asn, bsn))) ?? false) &&
          Object.is(a.vpc?.vpcId, b.vpc?.vpcId),
        source: 'db',
        cloud: new Crud2({
          create: async (es: LoadBalancer[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const subnets = (await getSubnets(client.ec2client)).map(s => s.SubnetId ?? '');
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
              const result = await createLoadBalancer(client.elbClient, input);
              // TODO: Handle if it fails (somehow)
              if (!result?.hasOwnProperty('LoadBalancerArn')) {
                // Failure
                throw new Error('what should we do here?');
              }
              // Re-get the inserted record to get all of the relevant records we care about
              const newObject = await getLoadBalancer(client.elbClient, result.LoadBalancerArn ?? '');
              // We map this into the same kind of entity as `obj`
              const newEntity = await AwsElbModule.utils.loadBalancerMapper(newObject, ctx);
              // Save the record back into the database to get the new fields updated
              await AwsElbModule.mappers.loadBalancer.db.update(newEntity, ctx);
              out.push(newEntity);
            }
            return out;
          },
          read: async (ctx: Context, id?: string) => {
            const client = (await ctx.getAwsClient()) as AWS;
            if (id) {
              const rawLoadBalancer = await getLoadBalancer(client.elbClient, id);
              if (!rawLoadBalancer) return;
              return await AwsElbModule.utils.loadBalancerMapper(rawLoadBalancer, ctx);
            } else {
              const lbs = await getLoadBalancers(client.elbClient);
              const out = [];
              for (const lb of lbs) {
                out.push(await AwsElbModule.utils.loadBalancerMapper(lb, ctx));
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
              const isUpdate =
                AwsElbModule.mappers.loadBalancer.cloud.updateOrReplace(cloudRecord, e) === 'update';
              if (isUpdate) {
                // Update ip address type
                if (!Object.is(cloudRecord.ipAddressType, e.ipAddressType)) {
                  await updateLoadBalancerIpAddressType(client.elbClient, {
                    LoadBalancerArn: e.loadBalancerArn,
                    IpAddressType: e.ipAddressType,
                  });
                  const updatedLoadBalancer = await getLoadBalancer(
                    client.elbClient,
                    e.loadBalancerArn ?? '',
                  );
                  updatedRecord = AwsElbModule.utils.loadBalancerMapper(updatedLoadBalancer, ctx);
                }
                // Update subnets
                if (
                  !(
                    Object.is(cloudRecord.subnets?.length, e.subnets?.length) &&
                    (cloudRecord.subnets?.every(
                      (csn: any) => !!e.subnets?.find(esn => Object.is(csn, esn)),
                    ) ??
                      false)
                  )
                ) {
                  await updateLoadBalancerSubnets(client.elbClient, {
                    LoadBalancerArn: e.loadBalancerArn,
                    Subnets: e.subnets?.filter(sn => !!sn),
                  });
                  const updatedLoadBalancer = await getLoadBalancer(
                    client.elbClient,
                    e.loadBalancerArn ?? '',
                  );
                  updatedRecord = AwsElbModule.utils.loadBalancerMapper(updatedLoadBalancer, ctx);
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
                  await updateLoadBalancerSecurityGroups(client.elbClient, {
                    LoadBalancerArn: e.loadBalancerArn,
                    SecurityGroups: e.securityGroups?.filter(sg => !!sg.groupId).map(sg => sg.groupId!),
                  });
                  const updatedLoadBalancer = await getLoadBalancer(
                    client.elbClient,
                    e.loadBalancerArn ?? '',
                  );
                  updatedRecord = AwsElbModule.utils.loadBalancerMapper(updatedLoadBalancer, ctx);
                }
                await AwsElbModule.mappers.loadBalancer.db.update(updatedRecord, ctx);
                out.push(updatedRecord);
              } else {
                // We need to delete the current cloud record and create the new one.
                // The id will be the same in database since `e` will keep it.
                await AwsElbModule.mappers.loadBalancer.cloud.delete(cloudRecord, ctx);
                out.push(await AwsElbModule.mappers.loadBalancer.cloud.create(e, ctx));
              }
            }
            return out;
          },
          delete: async (es: LoadBalancer[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const e of es) {
              await deleteLoadBalancer({ ...client }, e.loadBalancerArn!);
            }
          },
        }),
      }),
      targetGroup: new Mapper2<TargetGroup>({
        entity: TargetGroup,
        equals: (a: TargetGroup, b: TargetGroup) =>
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
          Object.is(a.unhealthyThresholdCount, b.unhealthyThresholdCount),
        source: 'db',
        cloud: new Crud2({
          create: async (es: TargetGroup[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const vpcs = await getVpcs(client.ec2client);
            const defaultVpc = vpcs.find(vpc => vpc.IsDefault === true) ?? {};
            const out = [];
            for (const e of es) {
              const result = await createTargetGroup(client.elbClient, {
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
              const newObject = await getTargetGroup(client.elbClient, result.TargetGroupArn ?? '');
              // We map this into the same kind of entity as `obj`
              const newEntity = await AwsElbModule.utils.targetGroupMapper(newObject, ctx);
              // Save the record back into the database to get the new fields updated
              await AwsElbModule.mappers.targetGroup.db.update(newEntity, ctx);
              out.push(newEntity);
            }
            return out;
          },
          read: async (ctx: Context, id?: string) => {
            const client = (await ctx.getAwsClient()) as AWS;
            if (id) {
              const rawTargetGroup = await getTargetGroup(client.elbClient, id);
              if (!rawTargetGroup) return;
              return await AwsElbModule.utils.targetGroupMapper(rawTargetGroup, ctx);
            } else {
              const tgs = await getTargetGroups(client.elbClient);
              const out = [];
              for (const tg of tgs) {
                const tgMapped = await AwsElbModule.utils.targetGroupMapper(tg, ctx);
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
                return await AwsElbModule.mappers.targetGroup.db.update(cloudRecord, ctx);
              }
              const isUpdate =
                AwsElbModule.mappers.targetGroup.cloud.updateOrReplace(cloudRecord, e) === 'update';
              if (isUpdate) {
                const updatedTargetGroup = await updateTargetGroup(client.elbClient, {
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
                out.push(AwsElbModule.utils.targetGroupMapper(updatedTargetGroup, ctx));
              } else {
                // We need to delete the current cloud record and create the new one.
                // The id will be the same in database since `e` will keep it.
                // TODO: what to do when a load balancer depends on the target group??
                await AwsElbModule.mappers.targetGroup.cloud.delete(cloudRecord, ctx);
                out.push(await AwsElbModule.mappers.targetGroup.cloud.create(e, ctx));
              }
            }
            return out;
          },
          delete: async (es: TargetGroup[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const e of es) {
              await deleteTargetGroup(client.elbClient, e.targetGroupArn!);
            }
          },
        }),
      }),
    },
  },
  __dirname,
);
