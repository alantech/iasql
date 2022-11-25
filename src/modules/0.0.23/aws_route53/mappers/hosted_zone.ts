import {
  Route53,
  HostedZone as AwsHostedZone,
  paginateListHostedZones,
  ChangeInfo,
} from '@aws-sdk/client-route-53';

import { AwsRoute53Module } from '..';
import { AWS, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { HostedZone, ResourceRecordSet } from '../entity';

const createHostedZone = crudBuilderFormat<Route53, 'createHostedZone', AwsHostedZone | undefined>(
  'createHostedZone',
  (Name, region) => ({ Name, CallerReference: `${region}-${Date.now()}` }),
  res => res?.HostedZone,
);
const getHostedZone = crudBuilderFormat<Route53, 'getHostedZone', AwsHostedZone | undefined>(
  'getHostedZone',
  Id => ({ Id }),
  res => res?.HostedZone,
);
const getHostedZones = paginateBuilder<Route53>(paginateListHostedZones, 'HostedZones');
const deleteHostedZone = crudBuilderFormat<Route53, 'deleteHostedZone', ChangeInfo | undefined>(
  'deleteHostedZone',
  Id => ({ Id }),
  res => res?.ChangeInfo,
);

export class HostedZoneMapper extends MapperBase<HostedZone> {
  module: AwsRoute53Module;
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

  getNameFromDomain(recordName: string, domain: string) {
    const nameIndex = recordName.indexOf(domain);
    return recordName.substring(0, nameIndex);
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
        const cloudRecord: HostedZone = ctx?.memo?.cloud?.HostedZone?.[e.hostedZoneId ?? ''];
        const oldDomainName = cloudRecord.domainName;
        const newEntity = await this.module.hostedZone.cloud.create(e, ctx);
        if (newEntity instanceof Array || !newEntity) continue;
        newEntity.id = cloudRecord.id;
        await this.module.hostedZone.db.update(newEntity, ctx);
        // Attach new default record sets (NS and SOA) and delete old ones from db
        const dbRecords: ResourceRecordSet[] = await this.module.resourceRecordSet.db.read(ctx);
        const relevantDbRecords = dbRecords.filter(
          rrs => rrs.parentHostedZone.id === cloudRecord.id && ['NS', 'SOA'].includes(rrs.recordType),
        );
        await this.module.resourceRecordSet.db.delete(relevantDbRecords, ctx);
        const cloudRecords: ResourceRecordSet[] = await this.module.resourceRecordSet.cloud.read(ctx);
        const relevantCloudRecords = cloudRecords.filter(
          rrs =>
            rrs.parentHostedZone.hostedZoneId === newEntity.hostedZoneId &&
            ['NS', 'SOA'].includes(rrs.recordType),
        );
        await this.module.resourceRecordSet.db.create(relevantCloudRecords, ctx);
        // Rename the ResourceRecordSets belonging to this HostedZone
        const recordsToRename = dbRecords.filter(
          rrs => rrs.parentHostedZone.id === e.id && !['NS', 'SOA'].includes(rrs.recordType),
        );
        recordsToRename.map(rrs => {
          // Extract previous record name without the old domain
          const name = this.getNameFromDomain(rrs.name, oldDomainName);
          if (name) {
            // Attach the new domain
            rrs.name = `${name}${cloudRecord.domainName}`;
          } else {
            // If no previous name extracted it's because it was the complete domain, we just need to replace it
            rrs.name = cloudRecord.domainName;
          }
        });
        await this.module.resourceRecordSet.db.update(recordsToRename, ctx);

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

  constructor(module: AwsRoute53Module) {
    super();
    this.module = module;
    super.init();
  }
}
