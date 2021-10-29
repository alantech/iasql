import { TargetGroup as TargetGroupAWS } from '@aws-sdk/client-elastic-load-balancing-v2'

import { AWS, } from '../services/gateways/aws'
import { TargetGroup, } from '../entity/target_group'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { Vpc } from '../entity'
import { VpcMapper } from '.'
import { inspect } from 'util'

export const TargetGroupMapper = new EntityMapper(TargetGroup, {
  targetGroupName: (tg: TargetGroupAWS) => tg.TargetGroupName,
  targetType: (tg: TargetGroupAWS) => tg.TargetType,
  targetGroupArn: (tg: TargetGroupAWS) => tg?.TargetGroupArn ?? null,
  ipAddressType: (tg: TargetGroupAWS) => tg?.IpAddressType ?? null,
  protocol: (tg: TargetGroupAWS) => tg?.Protocol ?? null,
  port: (tg: TargetGroupAWS) => tg?.Port ?? null,
  vpc: async (tg: TargetGroupAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (tg?.VpcId) {
      const vpc = await indexes.getOr(Vpc, tg.VpcId, awsClient.getVpc.bind(awsClient));
      return await VpcMapper.fromAWS(vpc, awsClient, indexes);
    } else {
      return null;
    }
  },
  healthCheckProtocol: (tg: TargetGroupAWS) => tg?.HealthCheckProtocol ?? null,
  healthCheckPort: (tg: TargetGroupAWS) => tg?.HealthCheckPort ?? null,
  healthCheckEnabled: (tg: TargetGroupAWS) => tg?.HealthCheckEnabled ?? null,
  healthCheckIntervalSeconds: (tg: TargetGroupAWS) => tg?.HealthCheckIntervalSeconds ?? null,
  healthCheckTimeoutSeconds: (tg: TargetGroupAWS) => tg?.HealthCheckTimeoutSeconds ?? null,
  healthyThresholdCount: (tg: TargetGroupAWS) => tg?.HealthyThresholdCount ?? null,
  unhealthyThresholdCount: (tg: TargetGroupAWS) => tg?.UnhealthyThresholdCount ?? null,
  healthCheckPath: (tg: TargetGroupAWS) => tg?.HealthCheckPath ?? null,
  protocolVersion: (tg: TargetGroupAWS) => tg?.ProtocolVersion ?? null,
},
  {
    readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
      const t1 = Date.now();
      const targetGroups = (await awsClient.getTargetGroups())?.TargetGroups ?? [];
      indexes.setAll(TargetGroup, targetGroups, 'TargetGroupArn');
      const t2 = Date.now();
      console.log(`TargetGroups set in ${t2 - t1}ms`);
    },
    createAWS: async (obj: TargetGroup, awsClient: AWS, indexes: IndexedAWS) => {
      console.log(inspect(obj, false, 7));
      const result = await awsClient.createTargetGroup({
        Name: obj.targetGroupName,
        TargetType: obj.targetType,
        Port: obj.port,
        VpcId: obj.vpc?.vpcId,
        Protocol: obj.protocol,
        ProtocolVersion: obj.protocolVersion,
        IpAddressType: obj.ipAddressType,
        HealthCheckProtocol: obj.healthCheckProtocol,
        HealthCheckPort: obj.healthCheckPort,
        HealthCheckPath: obj.healthCheckPath,
        HealthCheckEnabled: obj.healthCheckEnabled,
        HealthCheckIntervalSeconds: obj.healthCheckIntervalSeconds,
        HealthCheckTimeoutSeconds: obj.healthCheckTimeoutSeconds,
        HealthyThresholdCount: obj.healthyThresholdCount,
        UnhealthyThresholdCount: obj.unhealthyThresholdCount,
      });
      // TODO: Handle if it fails (somehow)
      if (!result?.hasOwnProperty('TargetGroupArn')) { // Failure
        throw new Error('what should we do here?');
      }
      const created = await awsClient.getTargetGroup(result.TargetGroupArn ?? '');
      indexes.set(TargetGroup, created?.TargetGroupArn ?? '', created);
      const newEntity: TargetGroup = await TargetGroupMapper.fromAWS(created, awsClient, indexes);
      newEntity.id = obj.id;
      for (const key of Object.keys(newEntity)) {
        (obj as any)[key] = (newEntity as any)[key];
      }
      return newEntity;
    },
    updateAWS: async (obj: TargetGroup, awsClient: AWS, indexes: IndexedAWS) => {
      const result = await awsClient.updateTargetGroup({
        TargetGroupArn: obj.targetGroupArn,
        HealthCheckProtocol: obj.healthCheckProtocol,
        HealthCheckPort: obj.healthCheckPort,
        HealthCheckPath: obj.healthCheckPath,
        HealthCheckEnabled: obj.healthCheckEnabled,
        HealthCheckIntervalSeconds: obj.healthCheckIntervalSeconds,
        HealthCheckTimeoutSeconds: obj.healthCheckTimeoutSeconds,
        HealthyThresholdCount: obj.healthyThresholdCount,
        UnhealthyThresholdCount: obj.unhealthyThresholdCount,
      });
      // TODO: Handle if it fails (somehow)
      if (!result?.hasOwnProperty('TargetGroupArn')) { // Failure
        throw new Error('what should we do here?');
      }
      const updated = await awsClient.getTargetGroup(result.TargetGroupArn ?? '');
      indexes.set(TargetGroup, updated?.TargetGroupArn ?? '', updated);
      const newEntity: TargetGroup = await TargetGroupMapper.fromAWS(updated, awsClient, indexes);
      newEntity.id = obj.id;
      for (const key of Object.keys(newEntity)) {
        (obj as any)[key] = (newEntity as any)[key];
      }
      return newEntity;
    },
    deleteAWS: async (obj: TargetGroup, awsClient: AWS, indexes: IndexedAWS) => {
      if (obj.targetGroupArn) {
        await awsClient.deleteTargetGroup(obj.targetGroupArn);
        // TODO: What does the error even look like? Docs are spotty on this
        indexes.del(TargetGroup, obj.targetGroupArn);
      }
      return obj;
    },
  }
)
