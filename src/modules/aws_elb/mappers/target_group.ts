import { EC2, paginateDescribeVpcs } from '@aws-sdk/client-ec2';
import {
  ElasticLoadBalancingV2,
  paginateDescribeTargetGroups,
  TargetGroup as TargetGroupAws,
} from '@aws-sdk/client-elastic-load-balancing-v2';
import { parse as parseArn } from '@aws-sdk/util-arn-parser';

import { AwsElbModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { awsVpcModule } from '../../aws_vpc';
import { Context, Crud2, MapperBase } from '../../interfaces';
import {
  ProtocolEnum,
  ProtocolVersionEnum,
  TargetGroup,
  TargetGroupIpAddressTypeEnum,
  TargetTypeEnum,
} from '../entity';

export class TargetGroupMapper extends MapperBase<TargetGroup> {
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
    Object.is(a.unhealthyThresholdCount, b.unhealthyThresholdCount) &&
    Object.is(a.region, b.region);

  async targetGroupMapper(tg: any, ctx: Context, region: string) {
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
        (await awsVpcModule.vpc.db.read(ctx, awsVpcModule.vpc.generateId({ vpcId: tg.VpcId, region }))) ??
        (await awsVpcModule.vpc.cloud.read(ctx, awsVpcModule.vpc.generateId({ vpcId: tg.VpcId, region })));
      if (tg.VpcId && !vpc) return undefined;
      out.vpc = vpc;
    } catch (e: any) {
      if (e.Code === 'InvalidVpcID.NotFound') return undefined;
    }
    out.region = region;
    return out;
  }

  getVpcs = paginateBuilder<EC2>(paginateDescribeVpcs, 'Vpcs');
  createTargetGroup = crudBuilderFormat<
    ElasticLoadBalancingV2,
    'createTargetGroup',
    TargetGroupAws | undefined
  >(
    'createTargetGroup',
    input => input,
    res => res?.TargetGroups?.pop(),
  );
  getTargetGroup = crudBuilderFormat<
    ElasticLoadBalancingV2,
    'describeTargetGroups',
    TargetGroupAws | undefined
  >(
    'describeTargetGroups',
    arn => ({ TargetGroupArns: [arn] }),
    res => res?.TargetGroups?.[0],
  );
  getTargetGroups = paginateBuilder<ElasticLoadBalancingV2>(paginateDescribeTargetGroups, 'TargetGroups');
  updateTargetGroup = crudBuilderFormat<
    ElasticLoadBalancingV2,
    'modifyTargetGroup',
    TargetGroupAws | undefined
  >(
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
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const vpcs = await this.getVpcs(client.ec2client);
        const defaultVpc = vpcs.find(vpc => vpc.IsDefault === true) ?? {};

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
        const newEntity = await this.targetGroupMapper(newObject, ctx, e.region);
        if (!newEntity) continue;
        newEntity.id = e.id;
        // Save the record back into the database to get the new fields updated
        await this.module.targetGroup.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, arn?: string) => {
      if (arn) {
        const region = parseArn(arn).region;
        const client = (await ctx.getAwsClient(region)) as AWS;
        const rawTargetGroup = await this.getTargetGroup(client.elbClient, arn);
        if (!rawTargetGroup) return;
        return await this.targetGroupMapper(rawTargetGroup, ctx, region);
      } else {
        const out: TargetGroup[] = [];
        const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const tgs = await this.getTargetGroups(client.elbClient);
            for (const tg of tgs) {
              const tgMapped = await this.targetGroupMapper(tg, ctx, region);
              if (tgMapped) out.push(tgMapped);
            }
          }),
        );
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
          Object.is(prev.protocolVersion, next.protocolVersion) &&
          Object.is(prev.region, next.region)
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
          const o = await this.targetGroupMapper(updatedTargetGroup, ctx, e.region);
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
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
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
