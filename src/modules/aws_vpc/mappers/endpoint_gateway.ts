import {
  CreateVpcEndpointCommandInput,
  EC2,
  ModifyVpcEndpointCommandInput,
  RouteTable,
  Tag,
  VpcEndpoint as AwsVpcEndpoint,
} from '@aws-sdk/client-ec2';

import { AwsVpcModule } from '..';
import { policiesAreSame } from '../../../services/aws-diff';
import { AWS, crudBuilderFormat } from '../../../services/aws_macros';
import { safeParse } from '../../../services/common';
import { Context, Crud, MapperBase } from '../../interfaces';
import { EndpointGateway } from '../entity';
import {
  createVpcEndpoint,
  deleteVpcEndpoint,
  getGatewayServiceFromServiceName,
  getVpcEndpoint,
  getVpcEndpointGateways,
  getVpcEndpointGatewayServiceName,
  modifyVpcEndpoint,
} from './endpoint_helpers';
import { eqTags, updateTags } from './tags';

export class EndpointGatewayMapper extends MapperBase<EndpointGateway> {
  module: AwsVpcModule;
  entity = EndpointGateway;
  equals = (a: EndpointGateway, b: EndpointGateway) =>
    Object.is(a.service, b.service) &&
    // the policy document is stringified json
    // we are trusting aws won't change it from under us
    policiesAreSame(a.policy, b.policy) &&
    Object.is(a.state, b.state) &&
    Object.is(a.vpc?.vpcId, b.vpc?.vpcId) &&
    Object.is(a.routeTableIds?.length, b.routeTableIds?.length) &&
    !!a.routeTableIds?.every(art => !!b.routeTableIds?.find(brt => Object.is(art, brt))) &&
    eqTags(a.tags, b.tags);

  async endpointGatewayMapper(eg: AwsVpcEndpoint, region: string, ctx: Context) {
    if (!eg.ServiceName) return undefined;
    const out = new EndpointGateway();
    out.vpcEndpointId = eg.VpcEndpointId;
    if (!out.vpcEndpointId) return undefined;
    const service = getGatewayServiceFromServiceName(eg.ServiceName);
    if (!service) return undefined;
    out.service = service;
    out.vpc =
      (await this.module.vpc.db.read(ctx, this.module.vpc.generateId({ vpcId: eg.VpcId ?? '', region }))) ??
      (await this.module.vpc.cloud.read(ctx, this.module.vpc.generateId({ vpcId: eg.VpcId ?? '', region })));
    if (!out.vpc) return undefined;
    out.policy = eg.PolicyDocument ? safeParse(eg.PolicyDocument) : null;
    out.state = eg.State;
    out.routeTableIds = eg.RouteTableIds;
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

  getVpcRouteTables = crudBuilderFormat<EC2, 'describeRouteTables', RouteTable[] | undefined>(
    'describeRouteTables',
    vpcId => ({
      Filters: [
        {
          Name: 'vpc-id',
          Values: [vpcId],
        },
      ],
    }),
    res => res?.RouteTables,
  );

  cloud: Crud<EndpointGateway> = new Crud({
    create: async (es: EndpointGateway[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const service = await getVpcEndpointGatewayServiceName(client.ec2client, e.service);
        if (!service) continue;

        const input: CreateVpcEndpointCommandInput = {
          VpcEndpointType: 'Gateway',
          ServiceName: service,
          VpcId: e.vpc?.vpcId,
        };
        if (e.policy) {
          input.PolicyDocument = JSON.stringify(e.policy);
        }
        if (e.routeTableIds?.length) {
          input.RouteTableIds = e.routeTableIds;
        } else {
          const vpcRouteTables = await this.getVpcRouteTables(client.ec2client, e.vpc?.vpcId ?? '');
          input.RouteTableIds = vpcRouteTables?.map(rt => rt.RouteTableId ?? '')?.filter(id => !!id) ?? [];
        }
        if (e.tags && Object.keys(e.tags).length) {
          const tags: Tag[] = Object.keys(e.tags).map((k: string) => {
            return {
              Key: k,
              Value: e.tags![k],
            };
          });
          input.TagSpecifications = [
            {
              ResourceType: 'vpc-endpoint',
              Tags: tags,
            },
          ];
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
