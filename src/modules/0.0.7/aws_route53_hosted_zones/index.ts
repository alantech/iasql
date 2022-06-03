import { ResourceRecordSet as AwsResourceRecordSet } from '@aws-sdk/client-route-53'
import { AWS, } from '../../../services/gateways/aws'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import { HostedZone } from './entity'
import { RecordType, ResourceRecordSet } from './entity/resource_records_set';
import * as metadata from './module.json'

export const AwsRoute53HostedZoneModule: Module2 = new Module2({
  ...metadata,
  utils: {
    hostedZoneMapper: (hz: any) => {
      const out = new HostedZone();
      if (!hz?.Id) throw new Error('No HostedZoneId defined');
      out.hostedZoneId = hz.Id;
      out.domainName = hz.Name;
      return out;
    },
    resourceRecordSetMapper: async (rrs: any, ctx: Context) => {
      const out = new ResourceRecordSet();
      if (!(rrs.Name && rrs.Type)) throw new Error('Wrong record from AWS');
      out.parentHostedZone = await AwsRoute53HostedZoneModule.mappers.hostedZone.db.read(ctx, rrs.HostedZoneId) ??
      await AwsRoute53HostedZoneModule.mappers.hostedZone.cloud.read(ctx, rrs.HostedZoneId);
      if (!out.parentHostedZone) throw new Error('Hosted zone need to be loaded.');
      out.name = rrs.Name;
      out.recordType = rrs.Type as RecordType;
      out.ttl = rrs.TTL;
      // TODO: right now just supporting `ResourceRecords`.
      // If AliasTarget or TrafficPolicyInstanceId do not fail but ignore that record
      if (!rrs.ResourceRecords && (rrs.AliasTarget || rrs.TrafficPolicyInstanceId)) return null;
      out.record = rrs.ResourceRecords?.map((o: { Value: string }) => o.Value).join('\n') ?? '';
      return out;
    },
    resourceRecordSetName: (rrs: any) => {
      const name = rrs.name && rrs.name[rrs.name.length - 1] ? (rrs.name[rrs.name.length - 1] === '.' ? rrs.name : `${rrs.name}.`) : '';
      const domainName = rrs.parentHostedZone.domainName;
      return `${name}${domainName}`;
    },
    getNameFromDomain: (recordName: string, domain: string) => {
      const nameIndex = recordName.indexOf(domain);
      return recordName.substring(0, nameIndex);
    }
  },
  mappers: {
    hostedZone: new Mapper2<HostedZone>({
      entity: HostedZone,
      equals: (a: HostedZone, b: HostedZone) => Object.is(a.domainName, b.domainName),
      source: 'db',
      cloud: new Crud2({
        create: async (hz: HostedZone[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of hz) {
            const createdHz = await client.createHostedZone(e.domainName);
            if (!createdHz?.Id) throw new Error('How this happen!?')
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getHostedZone(createdHz?.Id);
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsRoute53HostedZoneModule.utils.hostedZoneMapper(newObject, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Save the record back into the database to get the new fields updated
            await AwsRoute53HostedZoneModule.mappers.hostedZone.db.update(newEntity, ctx);
            out.push(newEntity);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const rawHostedZone = await client.getHostedZone(id);
            if (!rawHostedZone) return;
            return AwsRoute53HostedZoneModule.utils.hostedZoneMapper(rawHostedZone);
          } else {
            const hostedZones = (await client.getHostedZones()) ?? [];
            return hostedZones.map((hz: any) => AwsRoute53HostedZoneModule.utils.hostedZoneMapper(hz));
          }
        },
        updateOrReplace: () => 'replace',
        update: async (es: HostedZone[], ctx: Context) => {
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.HostedZone?.[e.hostedZoneId ?? ''];
            const newEntity = await AwsRoute53HostedZoneModule.mappers.hostedZone.cloud.create(e, ctx);
            newEntity.id = cloudRecord.id;
            await AwsRoute53HostedZoneModule.mappers.hostedZone.db.update(newEntity, ctx);
            // Attach new default record sets (NS and SOA) and delete old ones from db
            const dbRecords: ResourceRecordSet[] = await AwsRoute53HostedZoneModule.mappers.resourceRecordSet.db.read(ctx);
            const relevantDbRecords = dbRecords.filter(rrs => rrs.parentHostedZone.id === cloudRecord.id && ['NS', 'SOA'].includes(rrs.recordType));
            await AwsRoute53HostedZoneModule.mappers.resourceRecordSet.db.delete(relevantDbRecords, ctx);
            const cloudRecords: ResourceRecordSet[] = await AwsRoute53HostedZoneModule.mappers.resourceRecordSet.cloud.read(ctx);
            const relevantCloudRecords = cloudRecords.filter(rrs => rrs.parentHostedZone.hostedZoneId === newEntity.hostedZoneId && ['NS', 'SOA'].includes(rrs.recordType));
            await AwsRoute53HostedZoneModule.mappers.resourceRecordSet.db.create(relevantCloudRecords, ctx);
            out.push(newEntity);
          }
          return out;
        },
        delete: async (hz: HostedZone[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of hz) {
            await client.deleteHostedZone(e.hostedZoneId);
          }
        },
      }),
    }),
    resourceRecordSet: new Mapper2<ResourceRecordSet>({
      entity: ResourceRecordSet,
      entityId: (e: ResourceRecordSet) => `${e.recordType}|${e.name}`,
      equals: (a: ResourceRecordSet, b: ResourceRecordSet) =>
        Object.is(a.parentHostedZone?.hostedZoneId, b.parentHostedZone?.hostedZoneId)
        && Object.is(a.recordType, b.recordType)
        && Object.is(a.ttl, b.ttl)
        && Object.is(a.record, b.record),
      source: 'db',
      cloud: new Crud2({
        create: async (rrs: ResourceRecordSet[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of rrs) {
            const resourceRecordSet: AwsResourceRecordSet = {
              Name: e.name,
              Type: e.recordType,
              TTL: e.ttl,
              ResourceRecords: e.record.split('\n').map(r => ({ Value: r }))
            }
            await client.createResourceRecordSet(e.parentHostedZone.hostedZoneId, resourceRecordSet);
            // Re-get the inserted record to get all of the relevant records we care about
            const newResourceRecordSet = await client.getRecord(e.parentHostedZone.hostedZoneId, e.name, e.recordType);
            // We map this into the same kind of entity as `obj`
            const newObject = { ...newResourceRecordSet, HostedZoneId: e.parentHostedZone.hostedZoneId };
            const newEntity = await AwsRoute53HostedZoneModule.utils.resourceRecordSetMapper(newObject, ctx);
            if (!newEntity) return;
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Save the record back into the database to get the new fields updated
            await AwsRoute53HostedZoneModule.mappers.resourceRecordSet.db.update(newEntity, ctx);
            out.push(newEntity);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          const hostedZones = ctx.memo?.cloud?.HostedZone ?
            Object.values(ctx.memo?.cloud?.HostedZone) :
            await AwsRoute53HostedZoneModule.mappers.hostedZone.cloud.read(ctx);
          const resourceRecordSet: any = [];
          for (const hz of hostedZones) {
            try {
              const hzRecords = await client.getRecords(hz.hostedZoneId);
              resourceRecordSet.push(...hzRecords.map(r => ({ ...r, HostedZoneId: hz.hostedZoneId })));
            } catch (_) {
              // We try to retrieve the records for the repository, but if none it is not an error
              continue;
            }
          }
          if (id) {
            const [recordType, recordName] = id.split('|');
            const record = resourceRecordSet.find((rrs: any) => Object.is(rrs.Name, recordName) && Object.is(rrs.Type, recordType));
            if (record) return record;
          } else {
            const out = [];
            for (const rrs of resourceRecordSet) {
              const record = await AwsRoute53HostedZoneModule.utils.resourceRecordSetMapper(rrs, ctx);
              if (record) out.push(record);
            }
            return out;
          }
        },
        updateOrReplace: () => 'replace',
        update: async (es: ResourceRecordSet[], ctx: Context) => {
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.ResourceRecordSet[AwsRoute53HostedZoneModule.mappers.resourceRecordSet.entityId(e)];
            // First check if theres a new hosted zone, the name need to change since it is based on the domain name
            if (e.parentHostedZone.hostedZoneId !== cloudRecord.parentHostedZone.hostedZoneId) {
              // Extract previous record name without the old domain
              const name = AwsRoute53HostedZoneModule.utils.getNameFromDomain(e.name, cloudRecord.parentHostedZone.domainName);
              if (name) {
                // Attach the new domain
                e.name = `${name}${e.parentHostedZone.domainName}`;
              } else {
                // If no previous name extracted it's because it was the complete domain, we just need to replace it
                e.name = e.parentHostedZone.domainName;
              }
            }
            const newEntity = await AwsRoute53HostedZoneModule.mappers.resourceRecordSet.cloud.create(e, ctx);
            await AwsRoute53HostedZoneModule.mappers.resourceRecordSet.cloud.delete(cloudRecord, ctx);
            out.push(newEntity);
          }
          return out;
        },
        delete: async (rrs: ResourceRecordSet[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of rrs) {
            // AWS required to have at least one NS and one SOA record.
            // On a new hosted zone creation it creates them automatically if not defined
            // So we have to check if at least one of each in database before trying to delete.
            const dbHostedZone = await AwsRoute53HostedZoneModule.mappers.hostedZone.db.read(ctx, e.parentHostedZone.hostedZoneId);
            if (!!dbHostedZone && (Object.is(e.recordType, 'SOA') || Object.is(e.recordType, 'NS'))) {
              const recordsSet: ResourceRecordSet[] | undefined = await AwsRoute53HostedZoneModule.mappers.resourceRecordSet.db.read(ctx);
              let hasRecord;
              if (Object.is(e.recordType, 'SOA')) hasRecord = recordsSet?.some(r => Object.is(r.parentHostedZone.hostedZoneId, e.parentHostedZone.hostedZoneId)
                && Object.is(r.recordType, 'SOA'));
              if (Object.is(e.recordType, 'NS')) hasRecord = recordsSet?.some(r => Object.is(r.parentHostedZone.hostedZoneId, e.parentHostedZone.hostedZoneId)
                && Object.is(r.recordType, 'NS'));
              // If theres no record we have to created it in database instead of delete it from cloud
              if (!hasRecord) {
                await AwsRoute53HostedZoneModule.mappers.resourceRecordSet.db.create(e, ctx);
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
              ResourceRecords: e.record.split('\n').map(r => ({ Value: r }))
            };
            await client.deleteResourceRecordSet(e.parentHostedZone.hostedZoneId, resourceRecordSet);
          }
        },
      }),
    }),
  },
}, __dirname);
