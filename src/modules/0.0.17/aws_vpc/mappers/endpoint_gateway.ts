import {
  CreateVpcEndpointCommandInput,
  EC2,
  ModifyVpcEndpointCommandInput,
  RouteTable,
  Tag,
  UnsuccessfulItem,
  VpcEndpoint as AwsVpcEndpoint,
  paginateDescribeVpcEndpoints,
} from '@aws-sdk/client-ec2';

import { AwsVpcModule } from '..';
import { AWS, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { EndpointGateway, EndpointGatewayService } from '../entity';
import { eqTags, updateTags } from './tags';

export class EndpointGatewayMapper extends MapperBase<EndpointGateway> {
  module: AwsVpcModule;
  entity = EndpointGateway;
  equals = (a: EndpointGateway, b: EndpointGateway) =>
    Object.is(a.service, b.service) &&
    // the policy document is stringified json
    // we are trusting aws won't change it from under us
    Object.is(a.policyDocument, b.policyDocument) &&
    Object.is(a.state, b.state) &&
    Object.is(a.vpc?.vpcId, b.vpc?.vpcId) &&
    Object.is(a.routeTableIds?.length, b.routeTableIds?.length) &&
    !!a.routeTableIds?.every(art => !!b.routeTableIds?.find(brt => Object.is(art, brt))) &&
    eqTags(a.tags, b.tags);

  async endpointGatewayMapper(eg: AwsVpcEndpoint, ctx: Context) {
    if (!eg.ServiceName) return undefined;
    const out = new EndpointGateway();
    out.vpcEndpointId = eg.VpcEndpointId;
    if (!out.vpcEndpointId) return undefined;
    const service = this.getServiceFromServiceName(eg.ServiceName);
    if (!service) return undefined;
    out.service = service;
    out.vpc =
      (await this.module.vpc.db.read(ctx, eg.VpcId)) ?? (await this.module.vpc.cloud.read(ctx, eg.VpcId));
    if (!out.vpc) return undefined;
    out.policyDocument = eg.PolicyDocument;
    out.state = eg.State;
    out.routeTableIds = eg.RouteTableIds;
    if (eg.Tags?.length) {
      const tags: { [key: string]: string } = {};
      eg.Tags.filter((t: any) => !!t.Key && !!t.Value).forEach((t: any) => {
        tags[t.Key as string] = t.Value as string;
      });
      out.tags = tags;
    }
    return out;
  }

  getServiceFromServiceName(serviceName: string) {
    if (serviceName.includes('s3')) return EndpointGatewayService.S3;
    if (serviceName.includes('dynamodb')) return EndpointGatewayService.DYNAMODB;
  }

  getVpcEndpointGatewayServiceName = crudBuilderFormat<
    EC2,
    'describeVpcEndpointServices',
    string | undefined
  >(
    'describeVpcEndpointServices',
    (_service: string) => ({
      Filters: [
        {
          Name: 'service-type',
          Values: ['Gateway'],
        },
      ],
    }),
    (res, service: string) => res?.ServiceNames?.find(sn => sn.includes(service))
  );
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
    res => res?.RouteTables
  );
  createVpcEndpointGateway = crudBuilderFormat<EC2, 'createVpcEndpoint', AwsVpcEndpoint | undefined>(
    'createVpcEndpoint',
    input => input,
    res => res?.VpcEndpoint
  );
  getVpcEndpointGateway = crudBuilderFormat<EC2, 'describeVpcEndpoints', AwsVpcEndpoint | undefined>(
    'describeVpcEndpoints',
    endpointId => ({ VpcEndpointIds: [endpointId] }),
    res => res?.VpcEndpoints?.pop()
  );
  getVpcEndpointGateways = paginateBuilder<EC2>(
    paginateDescribeVpcEndpoints,
    'VpcEndpoints',
    undefined,
    undefined,
    () => ({
      Filters: [
        {
          Name: 'vpc-endpoint-type',
          Values: ['Gateway'],
        },
        // vpc-endpoint-state - The state of the endpoint:
        // pendingAcceptance | pending | available | deleting | deleted | rejected | failed
        {
          Name: 'vpc-endpoint-state',
          Values: ['available', 'rejected', 'failed'],
        },
      ],
    })
  );
  modifyVpcEndpointGateway = crudBuilderFormat<EC2, 'modifyVpcEndpoint', boolean | undefined>(
    'modifyVpcEndpoint',
    input => input,
    res => res?.Return
  );
  deleteVpcEndpointGateway = crudBuilderFormat<EC2, 'deleteVpcEndpoints', UnsuccessfulItem[] | undefined>(
    'deleteVpcEndpoints',
    endpointId => ({ VpcEndpointIds: [endpointId] }),
    res => res?.Unsuccessful
  );

  cloud: Crud2<EndpointGateway> = new Crud2({
    create: async (es: EndpointGateway[], ctx: Context) => {
      const out = [];
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        const input: CreateVpcEndpointCommandInput = {
          VpcEndpointType: 'Gateway',
          ServiceName: await this.getVpcEndpointGatewayServiceName(client.ec2client, e.service),
          VpcId: e.vpc?.vpcId,
        };
        if (e.policyDocument) {
          input.PolicyDocument = e.policyDocument;
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
        const res = await this.createVpcEndpointGateway(client.ec2client, input);
        const rawEndpointGateway = await this.getVpcEndpointGateway(
          client.ec2client,
          res?.VpcEndpointId ?? ''
        );
        if (!rawEndpointGateway) continue;
        const newEndpointGateway = await this.endpointGatewayMapper(rawEndpointGateway, ctx);
        if (!newEndpointGateway) continue;
        newEndpointGateway.id = e.id;
        await this.module.endpointGateway.db.update(newEndpointGateway, ctx);
        out.push(newEndpointGateway);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (!!id) {
        const rawEndpointGateway = await this.getVpcEndpointGateway(client.ec2client, id);
        if (!rawEndpointGateway) return;
        return await this.endpointGatewayMapper(rawEndpointGateway, ctx);
      } else {
        const out = [];
        for (const eg of await this.getVpcEndpointGateways(client.ec2client)) {
          const outEg = await this.endpointGatewayMapper(eg, ctx);
          if (outEg) out.push(outEg);
        }
        return out;
      }
    },
    updateOrReplace: (a: EndpointGateway, b: EndpointGateway) => {
      if (!(Object.is(a.vpc?.vpcId, b.vpc?.vpcId) && Object.is(a.service, b.service))) return 'replace';
      return 'update';
    },
    update: async (es: EndpointGateway[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.EndpointGateway?.[e.vpcEndpointId ?? ''];
        const isUpdate = this.module.endpointGateway.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          let update = false;
          if (!Object.is(cloudRecord.policyDocument, e.policyDocument)) {
            // VPC endpoint policy document update
            const input: ModifyVpcEndpointCommandInput = {
              VpcEndpointId: e.vpcEndpointId,
              PolicyDocument: e.policyDocument,
              ResetPolicy: !e.policyDocument,
            };
            await this.modifyVpcEndpointGateway(client.ec2client, input);
            update = true;
          }
          if (
            !(
              Object.is(cloudRecord.routeTableIds?.length, e.routeTableIds?.length) &&
              !!cloudRecord.routeTableIds?.every(
                (crrt: any) => !!e.routeTableIds?.find(ert => Object.is(crrt, ert))
              )
            )
          ) {
            // VPC endpoint route tables update
            const input: ModifyVpcEndpointCommandInput = {
              VpcEndpointId: e.vpcEndpointId,
              RemoveRouteTableIds: cloudRecord.routeTableIds,
              AddRouteTableIds: e.routeTableIds,
            };
            await this.modifyVpcEndpointGateway(client.ec2client, input);
            update = true;
          }
          if (!eqTags(cloudRecord.tags, e.tags)) {
            // Tags update
            await updateTags(client.ec2client, e.vpcEndpointId ?? '', e.tags);
            update = true;
          }
          if (update) {
            const rawEndpointGateway = await this.getVpcEndpointGateway(
              client.ec2client,
              e.vpcEndpointId ?? ''
            );
            if (!rawEndpointGateway) continue;
            const newEndpointGateway = await this.endpointGatewayMapper(rawEndpointGateway, ctx);
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
          const newEndpointGateway = await this.module.endpointGateway.cloud.create(e, ctx);
          await this.module.endpointGateway.cloud.delete(cloudRecord, ctx);
          out.push(newEndpointGateway);
        }
      }
      return out;
    },
    delete: async (es: EndpointGateway[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        await this.deleteVpcEndpointGateway(client.ec2client, e.vpcEndpointId ?? '');
      }
    },
  });

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
