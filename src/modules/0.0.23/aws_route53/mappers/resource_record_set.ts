import {
  ListResourceRecordSetsCommandInput,
  Route53,
  ResourceRecordSet as AwsResourceRecordSet,
  ResourceRecord,
} from '@aws-sdk/client-route-53';

import { AwsRoute53Module } from '..';
import { AWS, crudBuilder2 } from '../../../../services/aws_macros';
import { Context, Crud2, IdFields, MapperBase } from '../../../interfaces';
import { awsElbModule } from '../../aws_elb';
import { LoadBalancerTypeEnum } from '../../aws_elb/entity';
import { AliasTarget, RecordType, ResourceRecordSet } from '../entity';

const createResourceRecordSet = crudBuilder2<Route53, 'changeResourceRecordSets'>(
  'changeResourceRecordSets',
  (HostedZoneId, record) => ({
    HostedZoneId,
    ChangeBatch: {
      Changes: [
        {
          Action: 'CREATE',
          ResourceRecordSet: record,
        },
      ],
    },
  }),
);
const deleteResourceRecordSet = crudBuilder2<Route53, 'changeResourceRecordSets'>(
  'changeResourceRecordSets',
  (HostedZoneId, record) => ({
    HostedZoneId,
    ChangeBatch: {
      Changes: [
        {
          Action: 'DELETE',
          ResourceRecordSet: record,
        },
      ],
    },
  }),
);

// TODO: Convert this to a paginate form once AWS supports pagination on this one (seriously!?)
async function getRecords(client: Route53, hostedZoneId: string) {
  const records = [];
  let res;
  do {
    const input: ListResourceRecordSetsCommandInput = {
      HostedZoneId: hostedZoneId,
    };
    if (res?.NextRecordName) {
      input.StartRecordName = res.NextRecordName;
    }
    res = await client.listResourceRecordSets(input);
    records.push(...(res.ResourceRecordSets ?? []));
  } while (res?.IsTruncated);
  return records;
}
const getRecord = async (client: Route53, hostedZoneId: string, recordName: string, recordType: string) => {
  const records = await getRecords(client, hostedZoneId);
  return records.find(r => Object.is(r.Type, recordType) && Object.is(r.Name, recordName));
};

export class ResourceRecordSetMapper extends MapperBase<ResourceRecordSet> {
  module: AwsRoute53Module;
  entity = ResourceRecordSet;
  generateId = (fields: IdFields) => {
    const requiredFields = ['hostedZoneId', 'name', 'recordType'];
    if (
      Object.keys(fields).length !== requiredFields.length &&
      !Object.keys(fields).every(fk => requiredFields.includes(fk))
    ) {
      throw new Error(`Id generation error. Valid fields to generate id are: ${requiredFields.join(', ')}`);
    }
    return `${fields.hostedZoneId}|${fields.name}|${fields.recordType}`;
  };
  entityId = (e: ResourceRecordSet) =>
    this.generateId({
      hostedZoneId: e.parentHostedZone.hostedZoneId,
      name: e.name,
      recordType: e.recordType,
    });
  idFields = (id: string) => {
    const [hostedZoneId, name, recordType] = id.split('|');
    return { hostedZoneId, name, recordType };
  };
  equals = (a: ResourceRecordSet, b: ResourceRecordSet) =>
    Object.is(a.parentHostedZone?.hostedZoneId, b.parentHostedZone?.hostedZoneId) &&
    Object.is(a.recordType, b.recordType) &&
    Object.is(a.ttl, b.ttl) &&
    Object.is(a.record, b.record) &&
    Object.is(a.aliasTarget?.loadBalancer?.loadBalancerArn, b.aliasTarget?.loadBalancer?.loadBalancerArn) &&
    Object.is(a.aliasTarget?.evaluateTargetHealth, b.aliasTarget?.evaluateTargetHealth);

  async resourceRecordSetMapper(rrs: AwsResourceRecordSet & { HostedZoneId: string }, ctx: Context) {
    const out = new ResourceRecordSet();
    if (!(rrs.Name && rrs.Type)) return undefined;
    out.parentHostedZone =
      (await this.module.hostedZone.db.read(ctx, rrs.HostedZoneId)) ??
      (await this.module.hostedZone.cloud.read(ctx, rrs.HostedZoneId));
    if (!out.parentHostedZone) throw new Error('Hosted zone need to be loaded.');
    out.name = rrs?.Name ?? undefined;
    out.recordType = rrs.Type as RecordType;
    out.ttl = rrs.TTL;
    // TODO: right now just supporting `ResourceRecords` and `AliasTarget`.
    // If TrafficPolicyInstanceId do not fail but ignore that record
    if ((!rrs.ResourceRecords || !rrs.AliasTarget) && rrs.TrafficPolicyInstanceId) return null;
    if (rrs.ResourceRecords) {
      out.record = rrs.ResourceRecords?.map((o: ResourceRecord) => o.Value).join('\n') ?? '';
    } else if (rrs.AliasTarget) {
      out.aliasTarget = await this.aliasTargetMapper(rrs.AliasTarget, ctx);
    }
    if (!out.record && !out.aliasTarget) return undefined;
    return out;
  }

  async aliasTargetMapper(at: any, ctx: Context) {
    const out = new AliasTarget();
    out.evaluateTargetHealth = at.EvaluateTargetHealth;
    if (at.DNSName.includes('.elb.')) {
      // TODO: improve implementation
      let loadBalancer;
      const cleanAliasDns =
        at.DNSName[at.DNSName.length - 1] === '.'
          ? at.DNSName.substring(0, at.DNSName.length - 1)
          : at.DNSName;
      const dbLoadBalancers = await awsElbModule.loadBalancer.db.read(ctx);
      loadBalancer = dbLoadBalancers.find((lb: any) =>
        lb?.loadBalancerType === LoadBalancerTypeEnum.APPLICATION
          ? cleanAliasDns === `dualstack.${lb?.dnsName}`
          : cleanAliasDns === lb.dnsName,
      );
      if (!loadBalancer) {
        const cloudLoadBalancers = await awsElbModule.loadBalancer.cloud.read(ctx);
        loadBalancer = cloudLoadBalancers.find((lb: any) =>
          lb?.loadBalancerType === LoadBalancerTypeEnum.APPLICATION
            ? cleanAliasDns === `dualstack.${lb?.dnsName}`
            : cleanAliasDns === lb.dnsName,
        );
      }
      out.loadBalancer = loadBalancer;
      if (!out.loadBalancer) return undefined;
    } else {
      // We ignore other alias targets that are not ELB for now
      return undefined;
    }
    return out;
  }

  resourceRecordSetName(rrs: ResourceRecordSet) {
    const name =
      rrs.name && rrs.name[rrs.name.length - 1]
        ? rrs.name[rrs.name.length - 1] === '.'
          ? rrs.name
          : `${rrs.name}.`
        : '';
    const domainName = rrs.parentHostedZone.domainName;
    return `${name}${domainName}`;
  }

  db = new Crud2<ResourceRecordSet>({
    create: (es: ResourceRecordSet[], ctx: Context) => ctx.orm.save(ResourceRecordSet, es),
    update: (es: ResourceRecordSet[], ctx: Context) => ctx.orm.save(ResourceRecordSet, es),
    delete: (es: ResourceRecordSet[], ctx: Context) => ctx.orm.remove(ResourceRecordSet, es),
    read: async (ctx: Context, id?: string) => {
      // refer to entityId for the second input
      const { hostedZoneId, name, recordType } = id
        ? this.idFields(id)
        : { hostedZoneId: undefined, name: undefined, recordType: undefined };
      const opts =
        hostedZoneId && name && recordType
          ? {
              where: {
                parentHostedZone: {
                  id: hostedZoneId,
                },
                name,
                recordType,
              },
            }
          : {};
      return await ctx.orm.find(ResourceRecordSet, opts);
    },
  });

  cloud: Crud2<ResourceRecordSet> = new Crud2({
    create: async (rrs: ResourceRecordSet[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of rrs) {
        const resourceRecordSet: AwsResourceRecordSet = {
          Name: e.name,
          Type: e.recordType,
          TTL: e.ttl,
        };
        if (e.record) {
          resourceRecordSet.ResourceRecords = e.record.split('\n').map(r => ({ Value: r }));
        } else if (e.aliasTarget) {
          resourceRecordSet.AliasTarget = {
            HostedZoneId: e.aliasTarget.loadBalancer?.canonicalHostedZoneId,
            EvaluateTargetHealth: e.aliasTarget.evaluateTargetHealth,
            DNSName:
              e.aliasTarget?.loadBalancer?.loadBalancerType === LoadBalancerTypeEnum.APPLICATION
                ? `dualstack.${e.aliasTarget.loadBalancer?.dnsName}`
                : e.aliasTarget.loadBalancer?.dnsName,
          };
        }
        await createResourceRecordSet(
          client.route53Client,
          e.parentHostedZone.hostedZoneId,
          resourceRecordSet,
        );
        // Re-get the inserted record to get all of the relevant records we care about
        const newResourceRecordSet = await getRecord(
          client.route53Client,
          e.parentHostedZone.hostedZoneId,
          e.name,
          e.recordType,
        );
        if (!newResourceRecordSet) continue;
        // We map this into the same kind of entity as `obj`
        const newObject = { ...newResourceRecordSet, HostedZoneId: e.parentHostedZone.hostedZoneId };
        const newEntity = await this.resourceRecordSetMapper(newObject, ctx);
        if (!newEntity) continue;
        // We attach the original object's ID to this new one, indicating the exact record it is
        // replacing in the database.
        if (e.id) {
          // the entity is already in the database, fields need to be updated
          newEntity.id = e.id;
          // Save the record back into the database to get the new fields updated
          await this.module.resourceRecordSet.db.update(newEntity, ctx);
        }

        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const hostedZones = ctx.memo?.cloud?.HostedZone
        ? Object.values(ctx.memo?.cloud?.HostedZone)
        : await this.module.hostedZone.cloud.read(ctx);
      const resourceRecordSet: any = [];
      for (const hz of hostedZones) {
        try {
          const hzRecords = await getRecords(client.route53Client, hz.hostedZoneId);
          resourceRecordSet.push(...hzRecords.map(r => ({ ...r, HostedZoneId: hz.hostedZoneId })));
        } catch (_) {
          // We try to retrieve the records for the repository, but if none it is not an error
          continue;
        }
      }
      if (id) {
        const { name, recordType } = this.idFields(id);
        const record = resourceRecordSet.find(
          (rrs: any) => Object.is(rrs.Name, name) && Object.is(rrs.Type, recordType),
        );
        if (record) return record;
      } else {
        const out = [];
        for (const rrs of resourceRecordSet) {
          const record = await this.resourceRecordSetMapper(rrs, ctx);
          if (record) out.push(record);
        }
        return out;
      }
    },
    updateOrReplace: () => 'replace',
    update: async (es: ResourceRecordSet[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.ResourceRecordSet[this.entityId(e)];
        const newEntity = await this.module.resourceRecordSet.cloud.create(e, ctx);
        if (newEntity instanceof Array || !newEntity) continue;
        await this.module.resourceRecordSet.cloud.delete(cloudRecord, ctx);
        out.push(newEntity);
      }
      return out;
    },
    delete: async (rrs: ResourceRecordSet[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of rrs) {
        // AWS required to have at least one NS and one SOA record.
        // On a new hosted zone creation it creates them automatically if not defined
        // So we have to check if at least one of each in database before trying to delete.
        const dbHostedZone = await this.module.hostedZone.db.read(ctx, e.parentHostedZone.hostedZoneId);
        if (!!dbHostedZone && (Object.is(e.recordType, 'SOA') || Object.is(e.recordType, 'NS'))) {
          const recordsSet: ResourceRecordSet[] | undefined = await this.module.resourceRecordSet.db.read(
            ctx,
          );
          let hasRecord;
          if (Object.is(e.recordType, 'SOA'))
            hasRecord = recordsSet?.some(
              r =>
                Object.is(r.parentHostedZone.hostedZoneId, e.parentHostedZone.hostedZoneId) &&
                Object.is(r.recordType, 'SOA'),
            );
          if (Object.is(e.recordType, 'NS'))
            hasRecord = recordsSet?.some(
              r =>
                Object.is(r.parentHostedZone.hostedZoneId, e.parentHostedZone.hostedZoneId) &&
                Object.is(r.recordType, 'NS'),
            );
          // If theres no record we have to created it in database instead of delete it from cloud
          if (!hasRecord) {
            await this.module.resourceRecordSet.db.create(e, ctx);
            continue;
          }
        } else if (!dbHostedZone && (Object.is(e.recordType, 'SOA') || Object.is(e.recordType, 'NS'))) {
          // Do nothing if SOA or NS records but hosted zone have been deleted
          continue;
        }
        const resourceRecordSet: AwsResourceRecordSet = {
          Name: e.name,
          Type: e.recordType,
          TTL: e.ttl,
        };
        if (e.record) {
          resourceRecordSet.ResourceRecords = e.record.split('\n').map(r => ({ Value: r }));
        } else if (e.aliasTarget) {
          resourceRecordSet.AliasTarget = {
            HostedZoneId: e.aliasTarget.loadBalancer?.canonicalHostedZoneId,
            EvaluateTargetHealth: e.aliasTarget.evaluateTargetHealth,
            DNSName:
              e.aliasTarget?.loadBalancer?.loadBalancerType === LoadBalancerTypeEnum.APPLICATION
                ? `dualstack.${e.aliasTarget.loadBalancer?.dnsName}`
                : e.aliasTarget.loadBalancer?.dnsName,
          };
        }
        await deleteResourceRecordSet(
          client.route53Client,
          e.parentHostedZone.hostedZoneId,
          resourceRecordSet,
        );
      }
    },
  });

  constructor(module: AwsRoute53Module) {
    super();
    this.module = module;
    super.init();
  }
}
