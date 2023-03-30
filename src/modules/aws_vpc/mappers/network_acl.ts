import isEqual from 'lodash.isequal';

import {
  CreateNetworkAclCommandInput,
  EC2,
  NetworkAcl as AwsNetworkAcl,
  paginateDescribeNetworkAcls,
  Tag,
} from '@aws-sdk/client-ec2';

import { AwsVpcModule } from '..';
import { AWS, crudBuilder, crudBuilderFormat, eqTags, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { NetworkAcl } from '../entity';
import { updateTags } from './tags';

export class NetworkAclMapper extends MapperBase<NetworkAcl> {
  static readonly maxRuleNumber = 32766;
  module: AwsVpcModule;
  entity = NetworkAcl;
  equals = (a: NetworkAcl, b: NetworkAcl) => {
    return Object.is(a.vpc?.vpcId, b.vpc?.vpcId) && isEqual(a.entries, b.entries) && eqTags(a.tags, b.tags);
  };

  async networkAclMapper(eg: AwsNetworkAcl, region: string, ctx: Context) {
    if (!eg.NetworkAclId) return undefined;
    const out = new NetworkAcl();
    out.vpc =
      (await this.module.vpc.db.read(ctx, this.module.vpc.generateId({ vpcId: eg.VpcId ?? '', region }))) ??
      (await this.module.vpc.cloud.read(ctx, this.module.vpc.generateId({ vpcId: eg.VpcId ?? '', region })));
    out.entries = eg.Entries;
    if (eg.Tags?.length) {
      const tags: { [key: string]: string } = {};
      eg.Tags.filter((t: any) => !!t.Key && !!t.Value).forEach((t: any) => {
        tags[t.Key as string] = t.Value as string;
      });
      out.tags = tags;
    }
    out.networkAclId = eg.NetworkAclId;
    out.region = region;
    return out;
  }

  createNetworkAcl = crudBuilderFormat<EC2, 'createNetworkAcl', AwsNetworkAcl | undefined>(
    'createNetworkAcl',
    input => input,
    res => res?.NetworkAcl,
  );

  createNetworkAclEntry = crudBuilder<EC2, 'createNetworkAclEntry'>('createNetworkAclEntry', input => input);

  getNetworkAcl = crudBuilderFormat<EC2, 'describeNetworkAcls', AwsNetworkAcl | undefined>(
    'describeNetworkAcls',
    aclId => ({ NetworkAclIds: [aclId] }),
    res => res?.NetworkAcls?.pop(),
  );

  getNetworkAcls = paginateBuilder<EC2>(paginateDescribeNetworkAcls, 'NetworkAcls', undefined, undefined);

  deleteNetworkAclEntry = crudBuilder<EC2, 'deleteNetworkAclEntry'>('deleteNetworkAclEntry', input => input);

  deleteNetworkAcl = crudBuilder<EC2, 'deleteNetworkAcl'>('deleteNetworkAcl', networkAclId => ({
    NetworkAclId: networkAclId,
  }));

  cloud: Crud<NetworkAcl> = new Crud({
    create: async (es: NetworkAcl[], ctx: Context) => {
      const out = [];

      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;

        // we need to wait until vpc is created
        if (!e.vpc?.vpcId) continue;

        const input: CreateNetworkAclCommandInput = {
          VpcId: e.vpc?.vpcId,
        };
        if (e.tags && Object.keys(e.tags).length) {
          const tags: Tag[] = Object.keys(e.tags).map((k: string) => {
            return {
              Key: k,
              Value: e.tags![k],
            };
          });
          input.TagSpecifications = [
            {
              ResourceType: 'network-acl',
              Tags: tags,
            },
          ];
        }
        const res = await this.createNetworkAcl(client.ec2client, input);
        if (res) {
          // now we need to add the entries
          for (const entry of e.entries ?? []) {
            await this.createNetworkAclEntry(client.ec2client, entry);
          }
        }

        // re-read the network acl to get the updated results
        const rawAcl = await this.getNetworkAcl(client.ec2client, res?.NetworkAclId);
        if (rawAcl) {
          const newAcl = await this.networkAclMapper(rawAcl, e.region, ctx);
          if (newAcl) {
            newAcl.id = e.id;
            await this.db.update(newAcl, ctx);
            out.push(newAcl);
          }
        }
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      if (!!id) {
        const { networkAclId, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;
        const rawAcl = await this.getNetworkAcl(client.ec2client, networkAclId);
        if (!rawAcl || rawAcl.IsDefault) return undefined; // cannot read default acls
        return await this.networkAclMapper(rawAcl, region, ctx);
      } else {
        const out: NetworkAcl[] = [];
        const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            for (const eg of await this.getNetworkAcls(client.ec2client)) {
              if (eg && !eg.IsDefault) {
                // skip default acls
                const outEg = await this.networkAclMapper(eg, region, ctx);
                if (outEg) out.push(outEg);
              }
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: (a: NetworkAcl, b: NetworkAcl) => {
      // if we have modified vpc we need to replace
      if (!Object.is(a.vpc?.vpcId, b.vpc?.vpcId)) return 'replace';
      return 'update';
    },
    update: async (es: NetworkAcl[], ctx: Context) => {
      const out: NetworkAcl[] = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.NetworkAcl?.[this.entityId(e)];
        const isUpdate = this.module.networkAcl.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          let update = false;
          if (!isEqual(cloudRecord.entries, e.entries)) {
            // remove all non-default rules and recreate them
            for (const cloudRule of cloudRecord.entries ?? []) {
              // entries as 0 or >37266 are default rules and cannot be deleted
              if (!cloudRule.RuleNumber || cloudRule.RuleNumber > NetworkAclMapper.maxRuleNumber) continue;

              await this.deleteNetworkAclEntry(client.ec2client, {
                NetworkAclId: e.networkAclId,
                Egress: cloudRule.Egress,
                RuleNumber: cloudRule.RuleNumber,
              });
            }
            for (const entityRule of e.entries ?? []) {
              if (!entityRule.RuleNumber || entityRule.RuleNumber > 32766) continue;
              const input = { ...entityRule, NetworkAclId: e.networkAclId ?? '' };
              await this.createNetworkAclEntry(client.ec2client, input);
            }
            update = true;
          }
          if (!eqTags(cloudRecord.tags, e.tags)) {
            // Tags update
            await updateTags(client.ec2client, e.networkAclId ?? '', e.tags);
            update = true;
          }
          if (update) {
            const rawNetworkAcl = await this.getNetworkAcl(client.ec2client, e.networkAclId ?? '');
            if (!rawNetworkAcl) continue;
            const newNetworkAcl = await this.networkAclMapper(rawNetworkAcl, e.region, ctx);
            if (!newNetworkAcl) continue;
            newNetworkAcl.id = e.id;
            await this.module.networkAcl.db.update(newNetworkAcl, ctx);
            out.push(newNetworkAcl);
          }
        } else {
          // Replace record
          await this.module.networkAcl.cloud.delete(cloudRecord, ctx);
          const newAcl = await this.module.networkAcl.cloud.create(e, ctx);
          out.push(newAcl as NetworkAcl);
        }
      }
      return out;
    },
    delete: async (es: NetworkAcl[], ctx: Context) => {
      for (const e of es) {
        // if user tried to delete a default network acl, we need to restore it
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.deleteNetworkAcl(client.ec2client, e.networkAclId ?? '');
      }
    },
  });

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
