import { ResourceRecordSet as AwsResourceRecordSet } from '@aws-sdk/client-route-53'
import { AWS, } from '../../../services/gateways/aws'
import { Context, Crud, Mapper, Module, } from '../../interfaces'
import { HostedZone } from './entity'
import { RecordType, ResourceRecordSet } from './entity/resource_records_set';
import * as metadata from './module.json'

export const AwsRoute53HostedZoneModule: Module = new Module({
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
      const domainSplit = rrs.Name.split(out.parentHostedZone.domainName);
      if (domainSplit.length > 1) {
        out.name = domainSplit[0];
      }
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
    }
  },
  mappers: {
    hostedZone: new Mapper<HostedZone>({
      entity: HostedZone,
      equals: (a: HostedZone, b: HostedZone) => Object.is(a.domainName, b.domainName),
      source: 'db',
      cloud: new Crud({
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
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          let hostedZones = [];
          if (Array.isArray(ids)) {
            for (const id of ids) {
              hostedZones.push(await client.getHostedZone(id));
            }
          } else {
            hostedZones = (await client.getHostedZones()) ?? [];
          }
          return hostedZones.map((hz: any) => AwsRoute53HostedZoneModule.utils.hostedZoneMapper(hz));
        },
        updateOrReplace: () => 'replace',
        update: async (es: HostedZone[], ctx: Context) => {
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.HostedZone?.[e.hostedZoneId ?? ''];
            // We need to create the new entity in the cloud and keep the id.
            // In the next iteration the previous one will be deleted from.
            const newEntity = await AwsRoute53HostedZoneModule.mappers.hostedZone.cloud.create(e, ctx);
            newEntity.id = cloudRecord.id;
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
    resourceRecordSet: new Mapper<ResourceRecordSet>({
      entity: ResourceRecordSet,
      entityId: (e: ResourceRecordSet) => e.parentHostedZone?.hostedZoneId ?
        `${e.parentHostedZone.hostedZoneId}${AwsRoute53HostedZoneModule.utils.resourceRecordSetName(e)}${e.recordType}` : `${e.id}`,
      equals: (a: ResourceRecordSet, b: ResourceRecordSet) =>
        Object.is(AwsRoute53HostedZoneModule.utils.resourceRecordSetName(a), AwsRoute53HostedZoneModule.utils.resourceRecordSetName(b))
        && Object.is(a.parentHostedZone?.hostedZoneId, b.parentHostedZone?.hostedZoneId)
        && Object.is(a.recordType, b.recordType)
        && Object.is(a.ttl, b.ttl)
        && Object.is(a.record, b.record),
      source: 'db',
      cloud: new Crud({
        create: async (rrs: ResourceRecordSet[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of rrs) {
            const resourceRecordSet: AwsResourceRecordSet = {
              Name: AwsRoute53HostedZoneModule.utils.resourceRecordSetName(e),
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
        read: async (ctx: Context, _ids?: string[]) => {
          // TODO: How to identify a unique record? Is it necessary?
          const client = await ctx.getAwsClient() as AWS;
          const hostedZones = ctx.memo?.cloud?.HostedZone ?
            Object.values(ctx.memo?.cloud?.HostedZone) :
            await AwsRoute53HostedZoneModule.mappers.hostedZone.cloud.read(ctx);
          const records: any = [];
          for (const hz of hostedZones) {
            try {
              const hzRecords = await client.getRecords(hz.hostedZoneId);
              records.push(...hzRecords.map(r => ({ ...r, HostedZoneId: hz.hostedZoneId })));
            } catch (_) {
              // We try to retrieve the records for the repository, but if none it is not an error
              continue;
            }
          }
          const out = [];
          for (const r of records) {
            const rec = await AwsRoute53HostedZoneModule.utils.resourceRecordSetMapper(r, ctx);
            if (!rec) out.push(rec);
          }
          return out;
        },
        updateOrReplace: () => 'update',
        update: async (es: ResourceRecordSet[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.ResourceRecordSet[AwsRoute53HostedZoneModule.mappers.resourceRecordSet.entityId(e)];
            const resourceRecordSet: AwsResourceRecordSet = {
              Name: AwsRoute53HostedZoneModule.utils.resourceRecordSetName(e),
              Type: e.recordType,
              TTL: e.ttl,
              ResourceRecords: e.record.split('\n').map(r => ({ Value: r }))
            };
            await client.updateResourceRecordSet(e.parentHostedZone.hostedZoneId, resourceRecordSet);
            const updatedRecordSet = await client.getRecord(e.parentHostedZone.hostedZoneId, e.name, e.recordType);
            if (!updatedRecordSet) throw new Error('Error updating record');
            const newEntity = await AwsRoute53HostedZoneModule.utils.resourceRecordSetMapper(updatedRecordSet, ctx);
            if (!newEntity) continue;
            newEntity.id = cloudRecord.id;
            await AwsRoute53HostedZoneModule.mappers.resourceRecordSet.db.update(newEntity, ctx);
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
                return await AwsRoute53HostedZoneModule.mappers.resourceRecordSet.db.create(e, ctx);
              }
            } else if (!dbHostedZone && (Object.is(e.recordType, 'SOA') || Object.is(e.recordType, 'NS'))) {
              // Do nothing if SOA or NS records but hosted zone have been deleted
              return;
            }
            const resourceRecordSet: AwsResourceRecordSet = {
              Name: AwsRoute53HostedZoneModule.utils.resourceRecordSetName(e),
              Type: e.recordType,
              TTL: e.ttl,
              ResourceRecords: e.record.split('\n').map(r => ({ Value: r }))
            };
            return await client.deleteResourceRecordSet(e.parentHostedZone.hostedZoneId, resourceRecordSet);
          }
        },
      }),
    }),
  },
}, __dirname);
