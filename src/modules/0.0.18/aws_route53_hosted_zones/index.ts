import {
  ChangeInfo,
  HostedZone as AwsHostedZone,
  ListResourceRecordSetsCommandInput,
  ResourceRecord,
  ResourceRecordSet as AwsResourceRecordSet,
  Route53,
  paginateListHostedZones,
} from '@aws-sdk/client-route-53';

import { AWS, crudBuilderFormat, paginateBuilder, crudBuilder2 } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';
import { awsElbModule } from '../aws_elb';
import { AliasTarget, HostedZone } from './entity';
import { RecordType, ResourceRecordSet } from './entity/resource_records_set';

const createHostedZone = crudBuilderFormat<Route53, 'createHostedZone', AwsHostedZone | undefined>(
  'createHostedZone',
  (Name, region) => ({ Name, CallerReference: `${region}-${Date.now()}` }),
  res => res?.HostedZone
);
const getHostedZone = crudBuilderFormat<Route53, 'getHostedZone', AwsHostedZone | undefined>(
  'getHostedZone',
  Id => ({ Id }),
  res => res?.HostedZone
);
const getHostedZones = paginateBuilder<Route53>(paginateListHostedZones, 'HostedZones');
const deleteHostedZone = crudBuilderFormat<Route53, 'deleteHostedZone', ChangeInfo | undefined>(
  'deleteHostedZone',
  Id => ({ Id }),
  res => res?.ChangeInfo
);
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
  })
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
  })
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

class HostedZoneMapper extends MapperBase<HostedZone> {
  module: AwsRoute53HostedZoneModule;
  entity = HostedZone;
  equals = (a: HostedZone, b: HostedZone) => Object.is(a.domainName, b.domainName);

  hostedZoneMapper(hz: AwsHostedZone) {
    const out = new HostedZone();
    if (!hz?.Id) return undefined;
    out.hostedZoneId = hz.Id;
    if (!hz?.Name) return undefined;
    out.domainName = hz.Name;
    return out;
  }

  cloud: Crud2<HostedZone> = new Crud2({
    create: async (hz: HostedZone[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of hz) {
        const createdHz = await createHostedZone(client.route53Client, e.domainName, client.region);
        if (!createdHz?.Id) throw new Error('How this happen!?');
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await getHostedZone(client.route53Client, createdHz?.Id);
        if (!newObject) continue;
        // We map this into the same kind of entity as `obj`
        const newEntity = this.hostedZoneMapper(newObject);
        if (!newEntity) continue;
        // We attach the original object's ID to this new one, indicating the exact record it is
        // replacing in the database.
        newEntity.id = e.id;
        // Save the record back into the database to get the new fields updated
        await this.module.hostedZone.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawHostedZone = await getHostedZone(client.route53Client, id);
        if (!rawHostedZone) return;
        return this.hostedZoneMapper(rawHostedZone);
      } else {
        const hostedZones = (await getHostedZones(client.route53Client)) ?? [];
        const out = [];
        for (const hz of hostedZones) {
          const outHz = this.hostedZoneMapper(hz);
          if (outHz) out.push(outHz);
        }
        return out;
      }
    },
    updateOrReplace: () => 'replace',
    update: async (es: HostedZone[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.HostedZone?.[e.hostedZoneId ?? ''];
        const newEntity = await this.module.hostedZone.cloud.create(e, ctx);
        if (newEntity instanceof Array || !newEntity) continue;
        newEntity.id = cloudRecord.id;
        await this.module.hostedZone.db.update(newEntity, ctx);
        // Attach new default record sets (NS and SOA) and delete old ones from db
        const dbRecords: ResourceRecordSet[] = await this.module.resourceRecordSet.db.read(ctx);
        const relevantDbRecords = dbRecords.filter(
          rrs => rrs.parentHostedZone.id === cloudRecord.id && ['NS', 'SOA'].includes(rrs.recordType)
        );
        await this.module.resourceRecordSet.db.delete(relevantDbRecords, ctx);
        const cloudRecords: ResourceRecordSet[] = await this.module.resourceRecordSet.cloud.read(ctx);
        const relevantCloudRecords = cloudRecords.filter(
          rrs =>
            rrs.parentHostedZone.hostedZoneId === newEntity.hostedZoneId &&
            ['NS', 'SOA'].includes(rrs.recordType)
        );
        await this.module.resourceRecordSet.db.create(relevantCloudRecords, ctx);
        out.push(newEntity);
      }
      return out;
    },
    delete: async (hz: HostedZone[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of hz) {
        await deleteHostedZone(client.route53Client, e.hostedZoneId);
      }
    },
  });

  constructor(module: AwsRoute53HostedZoneModule) {
    super();
    this.module = module;
    super.init();
  }
}

class ResourceRecordSetMapper extends MapperBase<ResourceRecordSet> {
  module: AwsRoute53HostedZoneModule;
  entity = ResourceRecordSet;
  entityId = (e: ResourceRecordSet) => `${e.recordType}|${e.name}`;
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
      loadBalancer = dbLoadBalancers.find((lb: any) => Object.is(lb.dnsName, cleanAliasDns));
      if (!loadBalancer) {
        const cloudLoadBalancers = await awsElbModule.loadBalancer.cloud.read(ctx);
        loadBalancer = cloudLoadBalancers.find((lb: any) => Object.is(lb.dnsName, cleanAliasDns));
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

  getNameFromDomain(recordName: string, domain: string) {
    const nameIndex = recordName.indexOf(domain);
    return recordName.substring(0, nameIndex);
  }

  db = new Crud2<ResourceRecordSet>({
    create: (es: ResourceRecordSet[], ctx: Context) => ctx.orm.save(ResourceRecordSet, es),
    update: (es: ResourceRecordSet[], ctx: Context) => ctx.orm.save(ResourceRecordSet, es),
    delete: (es: ResourceRecordSet[], ctx: Context) => ctx.orm.remove(ResourceRecordSet, es),
    read: async (ctx: Context, recordTypeAndName?: string) => {
      const opts = recordTypeAndName
        ? {
            where: {
              recordType: recordTypeAndName.split('|')[0],
              name: recordTypeAndName.split('|')[1],
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
            DNSName: e.aliasTarget.loadBalancer?.dnsName,
          };
        }
        await createResourceRecordSet(
          client.route53Client,
          e.parentHostedZone.hostedZoneId,
          resourceRecordSet
        );
        // Re-get the inserted record to get all of the relevant records we care about
        const newResourceRecordSet = await getRecord(
          client.route53Client,
          e.parentHostedZone.hostedZoneId,
          e.name,
          e.recordType
        );
        if (!newResourceRecordSet) continue;
        // We map this into the same kind of entity as `obj`
        const newObject = { ...newResourceRecordSet, HostedZoneId: e.parentHostedZone.hostedZoneId };
        const newEntity = await this.resourceRecordSetMapper(newObject, ctx);
        if (!newEntity) return;
        // We attach the original object's ID to this new one, indicating the exact record it is
        // replacing in the database.
        newEntity.id = e.id;
        // Save the record back into the database to get the new fields updated
        await this.module.resourceRecordSet.db.update(newEntity, ctx);
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
        const [recordType, recordName] = id.split('|');
        const record = resourceRecordSet.find(
          (rrs: any) => Object.is(rrs.Name, recordName) && Object.is(rrs.Type, recordType)
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
        const cloudRecord = ctx?.memo?.cloud?.ResourceRecordSet[this.module.resourceRecordSet.entityId(e)];
        // First check if theres a new hosted zone, the name need to change since it is based on the domain name
        if (e.parentHostedZone.hostedZoneId !== cloudRecord.parentHostedZone.hostedZoneId) {
          // Extract previous record name without the old domain
          const name = this.getNameFromDomain(e.name, cloudRecord.parentHostedZone.domainName);
          if (name) {
            // Attach the new domain
            e.name = `${name}${e.parentHostedZone.domainName}`;
          } else {
            // If no previous name extracted it's because it was the complete domain, we just need to replace it
            e.name = e.parentHostedZone.domainName;
          }
        }
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
            ctx
          );
          let hasRecord;
          if (Object.is(e.recordType, 'SOA'))
            hasRecord = recordsSet?.some(
              r =>
                Object.is(r.parentHostedZone.hostedZoneId, e.parentHostedZone.hostedZoneId) &&
                Object.is(r.recordType, 'SOA')
            );
          if (Object.is(e.recordType, 'NS'))
            hasRecord = recordsSet?.some(
              r =>
                Object.is(r.parentHostedZone.hostedZoneId, e.parentHostedZone.hostedZoneId) &&
                Object.is(r.recordType, 'NS')
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
            DNSName: e.aliasTarget.loadBalancer?.dnsName,
          };
        }
        await deleteResourceRecordSet(
          client.route53Client,
          e.parentHostedZone.hostedZoneId,
          resourceRecordSet
        );
      }
    },
  });

  constructor(module: AwsRoute53HostedZoneModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsRoute53HostedZoneModule extends ModuleBase {
  hostedZone: HostedZoneMapper;
  resourceRecordSet: ResourceRecordSetMapper;

  constructor() {
    super();
    this.hostedZone = new HostedZoneMapper(this);
    this.resourceRecordSet = new ResourceRecordSetMapper(this);
    super.init();
  }
}
export const awsRoute53HostedZoneModule = new AwsRoute53HostedZoneModule();
