import {
  CreateNetworkAclCommandInput,
  EC2,
  NetworkAcl as AwsNetworkAcl,
  NetworkAclEntry,
  Tag,
} from '@aws-sdk/client-ec2';

import { AwsVpcModule } from '..';
import { AWS, crudBuilder, crudBuilderFormat, eqTags } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { NetworkAcl } from '../entity/network_acl';

export class NetworkAclMapper extends MapperBase<NetworkAcl> {
  module: AwsVpcModule;
  entity = NetworkAcl;
  equals = (a: NetworkAcl, b: NetworkAcl) =>
    Object.is(a.isDefault, b.isDefault) &&
    Object.is(a.vpc?.vpcId, b.vpc?.vpcId) &&
    Object.is(a.entries?.length, b.entries?.length) &&
    !!a.entries?.every(art => !!b.entries?.find(brt => Object.is(art, brt))) &&
    eqTags(a.tags, b.tags);

  async networkAclMapper(eg: AwsNetworkAcl, region: string, ctx: Context) {
    if (!eg.NetworkAclId) return undefined;
    const out = new NetworkAcl();
    out.vpc =
      (await this.module.vpc.db.read(ctx, this.module.vpc.generateId({ vpcId: eg.VpcId ?? '', region }))) ??
      (await this.module.vpc.cloud.read(ctx, this.module.vpc.generateId({ vpcId: eg.VpcId ?? '', region })));
    if (!out.vpc) return undefined;
    out.isDefault = eg.IsDefault ?? false;
    out.entries = eg.Entries;
    if (eg.Tags?.length) {
      const tags: { [key: string]: string } = {};
      eg.Tags.filter((t: any) => !!t.Key && !!t.Value).forEach((t: any) => {
        tags[t.Key as string] = t.Value as string;
      });
      out.tags = tags;
    }
    out.region = region;
    return out;
  }

  createNetworkAcl = crudBuilderFormat<EC2, 'createNetworkAcl', AwsNetworkAcl | undefined>(
    'createNetworkAcl',
    input => input,
    res => res?.NetworkAcl,
  );

  createNetworkAclEntry = crudBuilder<EC2, 'createNetworkAclEntry'>('createNetworkAclEntry', input => input);

  cloud: Crud<NetworkAcl> = new Crud({
    create: async (es: NetworkAcl[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
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
        const result = await this.createNetworkAcl(client.ec2client, input);
        if (result) {
          // now we need to create the entries
          for (const entry of e.entries ?? []) {
            const res = await this.createNetworkAclEntry(client.ec2client, {
              NetworkAclId: result.NetworkAclId,
              Egress: e.Egress,
              Protocol: e.Protocol,
              RuleAction: e.RuleAction,
              RuleNumber: e.RuleNumber,
              CidrBlock: e.CidrBlock,
              IcmpTypeCode: e.IcmpTypeCode,
              PortRange: e.PortRange,
            });
            if (entry) {
              result.Entries?.push(entry);
            }
          }
        }

        if (e.routeTableIds?.length) {
          input.RouteTableIds = e.routeTableIds;
        } else {
          const vpcRouteTables = await this.getVpcRouteTables(client.ec2client, e.vpc?.vpcId ?? '');
          input.RouteTableIds = vpcRouteTables?.map(rt => rt.RouteTableId ?? '')?.filter(id => !!id) ?? [];
        }
        const res = await createVpcEndpoint(client.ec2client, input);
        const rawEndpointGateway = await getVpcEndpoint(client.ec2client, res?.VpcEndpointId ?? '');
        if (!rawEndpointGateway) continue;
        const newEndpointGateway = await this.endpointGatewayMapper(rawEndpointGateway, e.region, ctx);
        if (!newEndpointGateway) continue;
        newEndpointGateway.id = e.id;
        await this.module.endpointGateway.db.update(newEndpointGateway, ctx);
        out.push(newEndpointGateway);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      if (!!id) {
        const { vpcEndpointId, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;
        const rawEndpointGateway = await getVpcEndpoint(client.ec2client, vpcEndpointId);
        if (!rawEndpointGateway) return;
        return await this.endpointGatewayMapper(rawEndpointGateway, region, ctx);
      } else {
        const out: EndpointGateway[] = [];
        const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            for (const eg of await getVpcEndpointGateways(client.ec2client)) {
              const outEg = await this.endpointGatewayMapper(eg, region, ctx);
              if (outEg) out.push(outEg);
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: (a: EndpointGateway, b: EndpointGateway) => {
      if (!(Object.is(a.vpc?.vpcId, b.vpc?.vpcId) && Object.is(a.service, b.service))) return 'replace';
      return 'update';
    },
    update: async (es: EndpointGateway[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.EndpointGateway?.[this.entityId(e)];
        const isUpdate = this.module.endpointGateway.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          let update = false;
          if (!policiesAreSame(cloudRecord.policy, e.policy)) {
            // VPC endpoint policy document update
            const input: ModifyVpcEndpointCommandInput = {
              VpcEndpointId: e.vpcEndpointId,
              PolicyDocument: JSON.stringify(e.policy),
              ResetPolicy: !e.policy,
            };
            await modifyVpcEndpoint(client.ec2client, input);
            update = true;
          }
          if (
            !(
              Object.is(cloudRecord.routeTableIds?.length, e.routeTableIds?.length) &&
              !!cloudRecord.routeTableIds?.every(
                (crrt: any) => !!e.routeTableIds?.find(ert => Object.is(crrt, ert)),
              )
            )
          ) {
            // VPC endpoint route tables update
            const input: ModifyVpcEndpointCommandInput = {
              VpcEndpointId: e.vpcEndpointId,
              RemoveRouteTableIds: cloudRecord.routeTableIds,
              AddRouteTableIds: e.routeTableIds,
            };
            await modifyVpcEndpoint(client.ec2client, input);
            update = true;
          }
          if (!eqTags(cloudRecord.tags, e.tags)) {
            // Tags update
            await updateTags(client.ec2client, e.vpcEndpointId ?? '', e.tags);
            update = true;
          }
          if (update) {
            const rawEndpointGateway = await getVpcEndpoint(client.ec2client, e.vpcEndpointId ?? '');
            if (!rawEndpointGateway) continue;
            const newEndpointGateway = await this.endpointGatewayMapper(rawEndpointGateway, e.region, ctx);
            if (!newEndpointGateway) continue;
            newEndpointGateway.id = e.id;
            await this.module.endpointGateway.db.update(newEndpointGateway, ctx);
            out.push(newEndpointGateway);
          } else {
            // Restore record
            cloudRecord.id = e.id;
            await this.module.endpointGateway.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          }
        } else {
          // Replace record
          let newEndpointGateway;
          newEndpointGateway = await this.module.endpointGateway.cloud.create(e, ctx);
          await this.module.endpointGateway.cloud.delete(cloudRecord, ctx);
          out.push(newEndpointGateway);
        }
      }
      return out;
    },
    delete: async (es: EndpointGateway[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await deleteVpcEndpoint(client.ec2client, e.vpcEndpointId ?? '');
      }
    },
  });

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
