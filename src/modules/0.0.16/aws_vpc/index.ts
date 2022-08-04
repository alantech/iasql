import {
  Address,
  AllocateAddressCommandInput,
  CreateNatGatewayCommandInput,
  CreateVpcCommandInput,
  CreateVpcEndpointCommandInput,
  DescribeNatGatewaysCommandInput,
  DescribeVpcsCommandInput,
  EC2,
  ModifyVpcEndpointCommandInput,
  NatGateway as AwsNatGateway,
  NatGatewayState as AwsNatGatewayState,
  RouteTable,
  Subnet as AwsSubnet,
  Tag,
  UnsuccessfulItem,
  Vpc as AwsVpc,
  VpcEndpoint as AwsVpcEndpoint,
  paginateDescribeNatGateways,
  paginateDescribeSubnets,
  paginateDescribeVpcEndpoints,
  paginateDescribeVpcs,
} from '@aws-sdk/client-ec2'
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter'

import {
  AWS,
  crudBuilder2,
  crudBuilderFormat,
  paginateBuilder,
} from '../../../services/aws_macros'
import {
  AvailabilityZone,
  ConnectivityType,
  ElasticIp,
  EndpointGateway,
  EndpointGatewayService,
  NatGateway,
  NatGatewayState,
  Subnet,
  SubnetState,
  Vpc,
  VpcState,
} from './entity'
import { Context, Crud2, Mapper2, ModuleBase, } from '../../interfaces'
import * as metadata from './module.json'
import isEqual from 'lodash.isequal'

const createSubnet = crudBuilder2<EC2, 'createSubnet'>('createSubnet', (input) => input);
const getSubnet = crudBuilderFormat<EC2, 'describeSubnets', AwsSubnet | undefined>(
  'describeSubnets',
  (id) => ({ SubnetIds: [id], }),
  (res) => res?.Subnets?.[0],
);
const getSubnets = paginateBuilder<EC2>(paginateDescribeSubnets, 'Subnets');
const deleteSubnet = crudBuilder2<EC2, 'deleteSubnet'>('deleteSubnet', (input) => input);

async function createVpc(client: EC2, input: CreateVpcCommandInput) {
  const res = await client.createVpc(input);
  const describeInput: DescribeVpcsCommandInput = {
    VpcIds: [res.Vpc?.VpcId ?? ''],
  };
  let out;
  await createWaiter<EC2, DescribeVpcsCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      describeInput,
      async (cl, cmd) => {
        const data = await cl.describeVpcs(cmd);
        try {
          out = data.Vpcs?.pop();
          // If it is not a final state we retry
          if ([VpcState.PENDING].includes(out?.State as VpcState)) {
            return {state: WaiterState.RETRY};
          }
          return {state: WaiterState.SUCCESS};
        } catch (e: any) {
          throw e;
        }
      },
  );
  return out;
}

const getVpc = crudBuilderFormat<EC2, 'describeVpcs', AwsVpc | undefined>(
    'describeVpcs',
    (id) => ({VpcIds: [id],}),
    (res) => res?.Vpcs?.[0],
);
const getVpcs = paginateBuilder<EC2>(paginateDescribeVpcs, 'Vpcs');
const deleteVpc = crudBuilder2<EC2, 'deleteVpc'>('deleteVpc', (input) => input);
const getNatGateway = crudBuilderFormat<EC2, 'describeNatGateways', AwsNatGateway | undefined>(
  'describeNatGateways',
  (id) => ({
    NatGatewayIds: [id],
    Filter: [
      {
        Name: 'state',
        Values: [AwsNatGatewayState.AVAILABLE, AwsNatGatewayState.FAILED]
      },
    ],
  }),
  (res) => res?.NatGateways?.pop(),
);
const getNatGateways = paginateBuilder<EC2>(
  paginateDescribeNatGateways,
  'NatGateways',
  undefined,
  undefined,
  () => ({
    Filter: [
      {
        Name: 'state',
        Values: [AwsNatGatewayState.AVAILABLE, AwsNatGatewayState.FAILED]
      },
    ],
  }),
);
const getElasticIp = crudBuilderFormat<EC2, 'describeAddresses', Address | undefined>(
  'describeAddresses',
  (allocationId) => ({ AllocationIds: [allocationId], }),
  (res) => res?.Addresses?.pop(),
);
const getAllIps = crudBuilder2<EC2, 'describeAddresses'>('describeAddresses', () => ({}));
const getElasticIps = async (client: EC2) => (await getAllIps(client))
  ?.Addresses
  ?.filter(a => !!a.AllocationId) ?? [];
const deleteElasticIp = crudBuilder2<EC2, 'releaseAddress'>(
  'releaseAddress',
  (AllocationId) => ({ AllocationId, }),
);
const getVpcEndpointGatewayServiceName = crudBuilderFormat<
  EC2,
  'describeVpcEndpointServices',
  string | undefined
>(
  'describeVpcEndpointServices',
  (_service: string) => ({
    Filters: [
      {
        Name: 'service-type',
        Values: ['Gateway']
      }
    ]
  }),
  (res, service: string) => res?.ServiceNames?.find(sn => sn.includes(service)),
);
const getVpcRouteTables = crudBuilderFormat<EC2, 'describeRouteTables', RouteTable[] | undefined>(
  'describeRouteTables',
  (vpcId) => ({
    Filters: [
      {
        Name: 'vpc-id',
        Values: [vpcId]
      }
    ]
  }),
  (res) => res?.RouteTables,
);
const createVpcEndpointGateway = crudBuilderFormat<
  EC2,
  'createVpcEndpoint',
  AwsVpcEndpoint | undefined
>(
  'createVpcEndpoint',
  (input) => input,
  (res) => res?.VpcEndpoint,
);
const getVpcEndpointGateway = crudBuilderFormat<
  EC2,
  'describeVpcEndpoints',
  AwsVpcEndpoint | undefined
>(
  'describeVpcEndpoints',
  (endpointId) => ({ VpcEndpointIds: [endpointId], }),
  (res) => res?.VpcEndpoints?.pop(),
);
const getVpcEndpointGateways = paginateBuilder<EC2>(
  paginateDescribeVpcEndpoints,
  'VpcEndpoints',
  undefined,
  undefined,
  () => ({
    Filters: [
      {
        Name: 'vpc-endpoint-type',
        Values: ['Gateway']
      },
      // vpc-endpoint-state - The state of the endpoint:
      // pendingAcceptance | pending | available | deleting | deleted | rejected | failed
      {
        Name: 'vpc-endpoint-state',
        Values: ['available', 'rejected', 'failed']
      }
    ]
  }),
);
const modifyVpcEndpointGateway = crudBuilderFormat<EC2, 'modifyVpcEndpoint', boolean | undefined>(
  'modifyVpcEndpoint',
  (input) => input,
  (res) => res?.Return,
);
const deleteVpcEndpointGateway = crudBuilderFormat<
  EC2,
  'deleteVpcEndpoints',
  UnsuccessfulItem[] | undefined
>(
  'deleteVpcEndpoints',
  (endpointId) => ({ VpcEndpointIds: [endpointId], }),
  (res) => res?.Unsuccessful,
);
const getAvailabilityZones = crudBuilder2<EC2, 'describeAvailabilityZones'>(
  'describeAvailabilityZones',
  (region) => ({
    Filters: [{
      Name: 'region-name',
      Values: [ region, ],
    }],
  }),
);

// TODO: Add a waiter macro
async function createNatGateway(client: EC2, input: CreateNatGatewayCommandInput) {
  let out;
  const res = await client.createNatGateway(input);
  out = res.NatGateway;
  const describeInput: DescribeNatGatewaysCommandInput = {
    NatGatewayIds: [res.NatGateway?.NatGatewayId ?? '']
  };
  await createWaiter<EC2, DescribeNatGatewaysCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    describeInput,
    async (cl, cmd) => {
      const data = await cl.describeNatGateways(cmd);
      try {
        out = data.NatGateways?.pop();
        // If it is not a final state we retry
        if ([AwsNatGatewayState.DELETING, AwsNatGatewayState.PENDING].includes(out?.State as AwsNatGatewayState)) {
          return { state: WaiterState.RETRY };
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        throw e;
      }
    },
  );
  return out;
}
async function deleteNatGateway(client: EC2, id: string) {
  await client.deleteNatGateway({
    NatGatewayId: id,
  });
  const describeInput: DescribeNatGatewaysCommandInput = {
    NatGatewayIds: [id ?? '']
  };
  await createWaiter<EC2, DescribeNatGatewaysCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    describeInput,
    async (cl, cmd) => {
      const data = await cl.describeNatGateways(cmd);
      try {
        const nat = data.NatGateways?.pop();
        // If it is not a final state we retry
        if ([AwsNatGatewayState.DELETING, AwsNatGatewayState.PENDING].includes(nat?.State as AwsNatGatewayState)) {
          return { state: WaiterState.RETRY };
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        throw e;
      }
    },
  );
}
// TODO: Figure out if/how to macro-ify this thing
async function updateTags(client: EC2, resourceId: string, tags?: { [key: string] : string }) {
  let tgs: Tag[] = [];
  if (tags) {
    tgs = Object.entries(tags).map(([Key, Value]) => ({ Key, Value}));
  }
  // recreate tags
  await client.deleteTags({
    Resources: [resourceId],
  });
  await client.createTags({
    Resources: [resourceId],
    Tags: tgs,
  })
}
// TODO: Why does this have tags baked in automatically?
async function createElasticIp(client: EC2, tags?: { [key: string] : string }) {
  const allocateAddressCommandInput: AllocateAddressCommandInput = {
    Domain: 'vpc',
  };
  if (tags) {
    let tgs: Tag[] = [];
    tgs = Object.entries(tags).map(([Key, Value]) => ({ Key, Value}));
    allocateAddressCommandInput.TagSpecifications = [
      {
        ResourceType: 'elastic-ip',
        Tags: tgs,
      },
    ];
  }
  return await client.allocateAddress(allocateAddressCommandInput);
}

class AwsVpcModule extends ModuleBase {
  constructor() { super(); super.init(); }
  dependencies = metadata.dependencies;

  async subnetMapper(sn: AwsSubnet, ctx: Context) {
    const out = new Subnet();
    if (!sn?.SubnetId || !sn?.VpcId) return undefined;
    out.state = sn.State as SubnetState;
    if (!sn.AvailabilityZone) return undefined;
    out.availabilityZone = await this.availabilityZone.db.read(ctx, sn.AvailabilityZone) ??
      await this.availabilityZone.cloud.read(ctx, sn.AvailabilityZone);
    out.vpc = await this.vpc.db.read(ctx, sn.VpcId) ??
      await this.vpc.cloud.read(ctx, sn.VpcId);
    if (sn.VpcId && !out.vpc) throw new Error(`Waiting for VPC ${sn.VpcId}`);
    if (out.vpc && out.vpc.vpcId && !out.vpc.id) {
      await this.vpc.db.create(out.vpc, ctx);
    }
    out.availableIpAddressCount = sn.AvailableIpAddressCount;
    out.cidrBlock = sn.CidrBlock;
    out.subnetId = sn.SubnetId;
    out.ownerId = sn.OwnerId;
    out.subnetArn = sn.SubnetArn;
    return out;
  }

  vpcMapper(vpc: AwsVpc) {
    const out = new Vpc();
    if (!vpc?.VpcId || !vpc?.CidrBlock) return undefined;
    out.vpcId = vpc.VpcId;
    out.cidrBlock = vpc.CidrBlock;
    out.state = vpc.State as VpcState;
    out.isDefault = vpc.IsDefault ?? false;
    const tags: { [key: string]: any } = {};
    (vpc.Tags || []).filter(t => t.hasOwnProperty('Key') && t.hasOwnProperty('Value')).forEach(t => {
      tags[t.Key as string] = t.Value;
    });
    out.tags = tags;

    return out;
  }

  async natGatewayMapper(nat: AwsNatGateway, ctx: Context) {
    const out = new NatGateway();
    out.connectivityType = nat.ConnectivityType as ConnectivityType;
    const natPublicAddress = nat.NatGatewayAddresses?.filter(n => !!n.AllocationId).pop();
    if (natPublicAddress?.AllocationId) {
      try {
        out.elasticIp = await this.elasticIp.db.read(ctx, natPublicAddress.AllocationId) ??
          await this.elasticIp.cloud.read(ctx, natPublicAddress.AllocationId);
      } catch (error: any) {
        if (error.Code === 'InvalidAllocationID.NotFound') return undefined;
      }
      if (!out.elasticIp) throw new Error('Not valid elastic ip, yet?');
    }
    out.natGatewayId = nat.NatGatewayId;
    out.state = nat.State as NatGatewayState;
    out.subnet = await this.subnet.db.read(ctx, nat.SubnetId) ??
      await this.subnet.cloud.read(ctx, nat.SubnetId);
    if (nat.SubnetId && !out.subnet) return undefined;
    const tags: { [key: string]: string } = {};
    (nat.Tags || []).filter(t => !!t.Key && !!t.Value).forEach(t => {
      tags[t.Key as string] = t.Value as string;
    });
    out.tags = tags;
    return out;
  }

  elasticIpMapper(eip: any) { // TODO: Fix this input type
    const out = new ElasticIp();
    out.allocationId = eip.AllocationId;
    if (!out.allocationId) return undefined;
    out.publicIp = eip.PublicIp;
    const tags: { [key: string]: string } = {};
    (eip.Tags || []).filter((t: any) => !!t.Key && !!t.Value).forEach((t: any) => {
      tags[t.Key as string] = t.Value as string;
    });
    out.tags = tags;
    return out;
  }

  async endpointGatewayMapper(eg: AwsVpcEndpoint, ctx: Context) {
    const out = new EndpointGateway();
    out.vpcEndpointId = eg.VpcEndpointId;
    if (!out.vpcEndpointId) return undefined;
    if (!eg.ServiceName) return undefined;
    const service = this.getServiceFromServiceName(eg.ServiceName);
    if (!service) return undefined;
    out.service = service;
    if (!out.service) return undefined;
    out.vpc = await this.vpc.db.read(ctx, eg.VpcId) ??
      await this.vpc.cloud.read(ctx, eg.VpcId);
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

  eqTags(a?: { [key: string]: string }, b?: { [key: string]: string }) {
    return isEqual(a, b);
  }

  subnet: Mapper2<Subnet> = new Mapper2<Subnet>({
    entity: Subnet,
    equals: (a: Subnet, b: Subnet) => Object.is(a.subnetId, b.subnetId) &&
      Object.is(a?.availabilityZone?.name, b?.availabilityZone?.name), // TODO: Do better
    source: 'db',
    cloud: new Crud2({
      create: async (es: Subnet[], ctx: Context) => {
        // TODO: Add support for creating default subnets (only one is allowed, also add
        // constraint that a single subnet is set as default)
        const client = await ctx.getAwsClient() as AWS;
        for (const e of es) {
          const input: any = {
            AvailabilityZone: e.availabilityZone.name,
            VpcId: e.vpc.vpcId,
          };
          if (e.cidrBlock) input.CidrBlock = e.cidrBlock;
          const res = await createSubnet(client.ec2client, input);
          if (res?.Subnet) {
            // TODO: How to not require it to be a singleton here?
            const newSubnet = await awsVpcModule.subnetMapper(res.Subnet, ctx);
            if (!newSubnet) continue;
            newSubnet.id = e.id;
            Object.keys(newSubnet).forEach(k => (e as any)[k] = (newSubnet as any)[k]);
            await awsVpcModule.subnet.db.update(e, ctx);
            // TODO: What to do if no subnet returned?
          }
        }
      },
      read: async (ctx: Context, id?: string) => {
        const client = await ctx.getAwsClient() as AWS;
        // TODO: Convert AWS subnet representation to our own
        if (!!id) {
          const rawSubnet = await getSubnet(client.ec2client, id);
          if (!rawSubnet) return;
          return await awsVpcModule.subnetMapper(rawSubnet, ctx);
        } else {
          const out = [];
          for (const sn of await getSubnets(client.ec2client)) {
            const sub = await awsVpcModule.subnetMapper(sn, ctx);
            if (sub) out.push(sub);
          }
          return out;
        }
      },
      update: async (es: Subnet[], ctx: Context) => {
        // There is no update mechanism for a subnet so instead we will create a new one and the
        // next loop through should delete the old one
        const out = await awsVpcModule.subnet.cloud.create(es, ctx);
        if (out && !(out instanceof Array)) return [out];
        return out; 
      },
      delete: async (es: Subnet[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        for (const e of es) {
          // Special behavior here. You're not allowed to mess with the "default" VPC or its subnets.
          // Any attempt to update it is instead turned into *restoring* the value in
          // the database to match the cloud value
          if (e.vpc?.isDefault) {
            // For delete, we have un-memoed the record, but the record passed in *is* the one
            // we're interested in, which makes it a bit simpler here
            const vpc = ctx?.memo?.db?.Vpc[e.vpc.vpcId ?? ''] ?? null;
            e.vpc.id = vpc.id;
            await awsVpcModule.subnet.db.update(e, ctx);
            // Make absolutely sure it shows up in the memo
            ctx.memo.db.Subnet[e.subnetId ?? ''] = e;
          } else {
            await deleteSubnet(client.ec2client, {
              SubnetId: e.subnetId,
            });
          }
        }
      },
    }),
  })

  vpc = new Mapper2<Vpc>({
    entity: Vpc,
    equals: (a: Vpc, b: Vpc) => {
      const result = Object.is(a.cidrBlock, b.cidrBlock) && Object.is(a.state, b.state) && Object.is(a.isDefault, b.isDefault) &&
        (awsVpcModule.eqTags(a.tags, b.tags));
      return result;
    },
    source: 'db',
    cloud: new Crud2({
      updateOrReplace: (a: Vpc, b: Vpc) => {
        if (!Object.is(a.cidrBlock, b.cidrBlock) || !Object.is(a.isDefault, b.isDefault)) return "replace";
        else return "update";
      },
      create: async (es: Vpc[], ctx: Context) => {
        // TODO: Add support for creating default VPCs (only one is allowed, also add constraint
        // that a single VPC is set as default)
        const client = await ctx.getAwsClient() as AWS;
        const out = [];
        for (const e of es) {
          let tgs: Tag[] = [];
          if (e.tags !== undefined && e.tags !== null) {
            const tags: {[key: string]: string} = e.tags;
            tgs = Object.keys(tags).map(k => {
              return {
                Key: k, Value: tags[k]
              }
            });
          }

          const input: CreateVpcCommandInput = {
            CidrBlock: e.cidrBlock,
          };

          if (tgs.length>0) {
            input.TagSpecifications=[
              {
                ResourceType: 'vpc',
                Tags: tgs,
              },
            ]
          };
          const res: AwsVpc | undefined = await createVpc(client.ec2client, input);
          if (res) {
            const newVpc = awsVpcModule.vpcMapper(res);
            if (!newVpc) continue;
            newVpc.id = e.id;
            await awsVpcModule.vpc.db.update(newVpc, ctx);
            out.push(newVpc);
          }
        }

        return out;
      },
      read: async (ctx: Context, id?: string) => {
        const client = await ctx.getAwsClient() as AWS;
        if (!!id) {
          const rawVpc = await getVpc(client.ec2client, id);
          if (!rawVpc) return;
          return awsVpcModule.vpcMapper(rawVpc);
        } else {
          // Typescript doesn't understand filter altering the output type :(
          const vpcs = await getVpcs(client.ec2client);
          const out = [];
          for (const vpc of vpcs) {
            const outVpc = awsVpcModule.vpcMapper(vpc);
            if (outVpc) out.push(outVpc);
          }
          return out;
        }
      },
      update: async (es: Vpc[], ctx: Context) => {
        // if user has modified state, restore it. If not, go with replace path
        const client = await ctx.getAwsClient() as AWS;
        const out = [];
        for (const e of es) {
          const cloudRecord = ctx?.memo?.cloud?.Vpc?.[e.vpcId ?? ''];
          if (!Object.is(e.state, cloudRecord.state)) {
            // Restore record
            cloudRecord.id = e.id;
            await awsVpcModule.vpc.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          } else {
            const isUpdate = Object.is(awsVpcModule.vpc.cloud.updateOrReplace(cloudRecord, e), 'update');
            if (!isUpdate) {
              // if CIDR is different we do the create
              const newVpc = await awsVpcModule.vpc.cloud.create(e, ctx) as Vpc; // TODO: Make this typesafe
              out.push(newVpc);
            } else {
              if (!awsVpcModule.eqTags(e.tags, cloudRecord.tags) && e.vpcId) {
                await updateTags(client.ec2client, e.vpcId, e.tags);
              }
              out.push(e);
            }
          }
        }
        return out;
      },
      delete: async (es: Vpc[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        for (const e of es) {
          // Special behavior here. You're not allowed to mess with the "default" VPC.
          // Any attempt to update it is instead turned into *restoring* the value in
          // the database to match the cloud value
          if (e.isDefault) {
            // For delete, we have un-memoed the record, but the record passed in *is* the one
            // we're interested in, which makes it a bit simpler here
            await awsVpcModule.vpc.db.update(e, ctx);
            // Make absolutely sure it shows up in the memo
            ctx.memo.db.Vpc[e.vpcId ?? ''] = e;
            const subnets = ctx?.memo?.cloud?.Subnet ?? [];
            const relevantSubnets = subnets.filter(
              (s: Subnet) => s.vpc.vpcId === e.vpcId
            );
            if (relevantSubnets.length > 0) {
              await awsVpcModule.subnet.db.update(relevantSubnets, ctx);
            }
          } else {
            await deleteVpc(client.ec2client, {
              VpcId: e.vpcId,
            });
          }
        }
      },
    }),
  })

  natGateway = new Mapper2<NatGateway>({
    entity: NatGateway,
    equals: (a: NatGateway, b: NatGateway) => Object.is(a.connectivityType, b.connectivityType)
      && Object.is(a.elasticIp?.allocationId, b.elasticIp?.allocationId)
      && Object.is(a.state, b.state)
      && Object.is(a.subnet?.subnetArn, b.subnet?.subnetArn)
      && awsVpcModule.eqTags(a.tags, b.tags),
    source: 'db',
    cloud: new Crud2({
      create: async (es: NatGateway[], ctx: Context) => {
        const out = [];
        const client = await ctx.getAwsClient() as AWS;
        for (const e of es) {
          const input: CreateNatGatewayCommandInput = {
            SubnetId: e.subnet?.subnetId,
            ConnectivityType: e.connectivityType,
          };
          if (e.tags && Object.keys(e.tags).length) {
            const tags: Tag[] = Object.keys(e.tags).map((k: string) => {
              return {
                Key: k, Value: e.tags![k],
              }
            });
            input.TagSpecifications = [
              {
                ResourceType: 'natgateway',
                Tags: tags,
              },
            ]
          }
          if (e.elasticIp) {
            input.AllocationId = e.elasticIp.allocationId;
            if (!input.AllocationId) throw new Error('Elastic ip need to be created first');
          } else if (!e.elasticIp && e.connectivityType === ConnectivityType.PUBLIC) {
            const elasticIp = new ElasticIp();
            // Attach the same tags in case we want to associate them visualy through the AWS Console
            elasticIp.tags = e.tags;
            const newElasticIp = await awsVpcModule.elasticIp.cloud.create(elasticIp, ctx);
            if (!newElasticIp || newElasticIp instanceof Array) continue;
            input.AllocationId = newElasticIp.allocationId;
          }
          const res: AwsNatGateway | undefined = await createNatGateway(client.ec2client, input);
          if (res) {
            const newNatGateway = await awsVpcModule.natGatewayMapper(res, ctx);
            if (!newNatGateway) continue;
            newNatGateway.id = e.id;
            await awsVpcModule.natGateway.db.update(newNatGateway, ctx);
            out.push(newNatGateway);
          }
        }
        return out;
      },
      read: async (ctx: Context, id?: string) => {
        const client = await ctx.getAwsClient() as AWS;
        if (!!id) {
          const rawNatGateway = await getNatGateway(client.ec2client, id);
          if (!rawNatGateway) return;
          return await awsVpcModule.natGatewayMapper(rawNatGateway, ctx);
        } else {
          const out = [];
          for (const ng of (await getNatGateways(client.ec2client))) {
            const outNat = await awsVpcModule.natGatewayMapper(ng, ctx);
            if (outNat) out.push(outNat);
          }
          return out;
        }
      },
      updateOrReplace: (a: NatGateway, b: NatGateway) => {
        if (!(Object.is(a.state, b.state) && awsVpcModule.eqTags(a.tags, b.tags))
          && Object.is(a.connectivityType, b.connectivityType)
          && Object.is(a.elasticIp?.allocationId, b.elasticIp?.allocationId)
          && Object.is(a.subnet?.subnetId, b.subnet?.subnetId)) return 'update';
        return 'replace';
      },
      update: async (es: NatGateway[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        const out = [];
        for (const e of es) {
          const cloudRecord = ctx?.memo?.cloud?.NatGateway?.[e.natGatewayId ?? ''];
          // `isUpdate` means only `tags` and/or `state` have changed
          const isUpdate = Object.is(awsVpcModule.natGateway.cloud.updateOrReplace(cloudRecord, e), 'update');
          if (isUpdate && !awsVpcModule.eqTags(cloudRecord.tags, e.tags)) {
            // If `tags` have changed, no matter if `state` changed or not, we update the tags, call AWS and update the DB
            await updateTags(client.ec2client, e.natGatewayId ?? '', e.tags);
            const rawNatGateway = await getNatGateway(client.ec2client, e.natGatewayId ?? '');
            if (!rawNatGateway) continue;
            const updatedNatGateway = await awsVpcModule.natGatewayMapper(rawNatGateway, ctx);
            if (!updatedNatGateway) continue;
            updatedNatGateway.id = e.id;
            await awsVpcModule.natGateway.db.update(updatedNatGateway, ctx);
            out.push(updatedNatGateway);
          } else if (isUpdate && awsVpcModule.eqTags(cloudRecord.tags, e.tags)) {
            // If `tags` have **not** changed, it means only `state` changed. This is the restore path. We do not call AWS again, just use the record we have in memo.
            cloudRecord.id = e.id;
            await awsVpcModule.natGateway.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          } else {
            // Replace path
            // Need to delete first to make the elastic ip address available
            await awsVpcModule.natGateway.cloud.delete(cloudRecord, ctx);
            const newNatGateway = await awsVpcModule.natGateway.cloud.create(e, ctx) as NatGateway;
            out.push(newNatGateway);
          }
        }
        return out;
      },
      delete: async (es: NatGateway[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        for (const e of es) {
          await deleteNatGateway(client.ec2client, e.natGatewayId ?? '');
        }
      },
    }),
  })

  elasticIp = new Mapper2<ElasticIp>({
    entity: ElasticIp,
    equals: (a: ElasticIp, b: ElasticIp) => Object.is(a.publicIp, b.publicIp)
      && awsVpcModule.eqTags(a.tags, b.tags),
    source: 'db',
    cloud: new Crud2({
      create: async (es: ElasticIp[], ctx: Context) => {
        const out = [];
        const client = await ctx.getAwsClient() as AWS;
        for (const e of es) {
          const res = await createElasticIp(client.ec2client, e.tags);
          const rawElasticIp = await getElasticIp(client.ec2client, res.AllocationId ?? '');
          const newElasticIp = awsVpcModule.elasticIpMapper(rawElasticIp);
          if (!newElasticIp) continue;
          newElasticIp.id = e.id;
          await awsVpcModule.elasticIp.db.update(newElasticIp, ctx);
          out.push(newElasticIp);
        }
        return out;
      },
      read: async (ctx: Context, id?: string) => {
        const client = await ctx.getAwsClient() as AWS;
        if (!!id) {
          const rawElasticIp = await getElasticIp(client.ec2client, id);
          if (!rawElasticIp) return;
          return awsVpcModule.elasticIpMapper(rawElasticIp);
        } else {
          const out = [];
          for (const eip of (await getElasticIps(client.ec2client))) {
            const outIp = awsVpcModule.elasticIpMapper(eip);
            if (outIp) out.push(outIp);
          }
          return out;
        }
      },
      update: async (es: ElasticIp[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        // Elastic ip properties cannot be updated other than tags.
        // If the public ip is updated we just restor it
        const out = [];
        for (const e of es) {
          const cloudRecord = ctx?.memo?.cloud?.ElasticIp?.[e.allocationId ?? ''];
          if (e.tags && !awsVpcModule.eqTags(cloudRecord.tags, e.tags)) {
            await updateTags(client.ec2client, e.allocationId ?? '', e.tags);
            const rawElasticIp = await getElasticIp(client.ec2client, e.allocationId ?? '');
            const newElasticIp = awsVpcModule.elasticIpMapper(rawElasticIp);
            if (!newElasticIp) continue;
            newElasticIp.id = e.id;
            await awsVpcModule.elasticIp.db.update(newElasticIp, ctx);
            // Push
            out.push(newElasticIp);
            continue;
          }
          cloudRecord.id = e.id;
          await awsVpcModule.elasticIp.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
        }
        return out;
      },
      delete: async (es: ElasticIp[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        for (const e of es) {
          await deleteElasticIp(client.ec2client, e.allocationId ?? '');
        }
      },
    }),
  })

  endpointGateway = new Mapper2<EndpointGateway>({
    entity: EndpointGateway,
    equals: (a: EndpointGateway, b: EndpointGateway) => Object.is(a.service, b.service)
      // the policy document is stringified json
      // we are trusting aws won't change it from under us
      && Object.is(a.policyDocument, b.policyDocument)
      && Object.is(a.state, b.state)
      && Object.is(a.vpc?.vpcId, b.vpc?.vpcId)
      && Object.is(a.routeTableIds?.length, b.routeTableIds?.length)
      && !!a.routeTableIds?.every(art => !!b.routeTableIds?.find(brt => Object.is(art, brt)))
      && awsVpcModule.eqTags(a.tags, b.tags),
    source: 'db',
    cloud: new Crud2({
      create: async (es: EndpointGateway[], ctx: Context) => {
        const out = [];
        const client = await ctx.getAwsClient() as AWS;
        for (const e of es) {
          const input: CreateVpcEndpointCommandInput = {
            VpcEndpointType: 'Gateway',
            ServiceName: await getVpcEndpointGatewayServiceName(client.ec2client, e.service),
            VpcId: e.vpc?.vpcId,
          };
          if (e.policyDocument) {
            input.PolicyDocument = e.policyDocument;
          }
          if (e.routeTableIds?.length) {
            input.RouteTableIds = e.routeTableIds;
          } else {
            const vpcRouteTables = await getVpcRouteTables(client.ec2client, e.vpc?.vpcId ?? '');
            input.RouteTableIds = vpcRouteTables?.map(rt => rt.RouteTableId ?? '')?.filter(id => !!id) ?? [];
          }
          if (e.tags && Object.keys(e.tags).length) {
            const tags: Tag[] = Object.keys(e.tags).map((k: string) => {
              return {
                Key: k, Value: e.tags![k],
              }
            });
            input.TagSpecifications = [
              {
                ResourceType: 'vpc-endpoint',
                Tags: tags,
              },
            ];
          }
          const res = await createVpcEndpointGateway(client.ec2client, input);
          const rawEndpointGateway = await getVpcEndpointGateway(client.ec2client, res?.VpcEndpointId ?? '');
          if (!rawEndpointGateway) continue;
          const newEndpointGateway = await awsVpcModule.endpointGatewayMapper(rawEndpointGateway, ctx);
          if (!newEndpointGateway) continue;
          newEndpointGateway.id = e.id;
          await awsVpcModule.endpointGateway.db.update(newEndpointGateway, ctx);
          out.push(newEndpointGateway);
        }
        return out;
      },
      read: async (ctx: Context, id?: string) => {
        const client = await ctx.getAwsClient() as AWS;
        if (!!id) {
          const rawEndpointGateway = await getVpcEndpointGateway(client.ec2client, id);
          if (!rawEndpointGateway) return;
          return await awsVpcModule.endpointGatewayMapper(rawEndpointGateway, ctx);
        } else {
          const out = [];
          for (const eg of (await getVpcEndpointGateways(client.ec2client))) {
            const outEndpoint = await awsVpcModule.endpointGatewayMapper(eg, ctx);
            if (outEndpoint) out.push(outEndpoint);
          }
          return out;
        }
      },
      updateOrReplace: (a: EndpointGateway, b: EndpointGateway) => {
        if (!(Object.is(a.vpc?.vpcId, b.vpc?.vpcId) && Object.is(a.service, b.service))) return 'replace';
        return 'update';
      },
      update: async (es: EndpointGateway[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        const out = [];
        for (const e of es) {
          const cloudRecord = ctx?.memo?.cloud?.EndpointGateway?.[e.vpcEndpointId ?? ''];
          const isUpdate = awsVpcModule.endpointGateway.cloud.updateOrReplace(cloudRecord, e) === 'update';
          if (isUpdate) {
            let update = false;
            if (!Object.is(cloudRecord.policyDocument, e.policyDocument)) {
              // VPC endpoint policy document update
              const input: ModifyVpcEndpointCommandInput = {
                VpcEndpointId: e.vpcEndpointId,
                PolicyDocument: e.policyDocument,
                ResetPolicy: !e.policyDocument
              };
              await modifyVpcEndpointGateway(client.ec2client, input);
              update = true;
            }
            if (!(Object.is(cloudRecord.routeTableIds?.length, e.routeTableIds?.length)
                && !!cloudRecord.routeTableIds?.every((crrt: any) => !!e.routeTableIds?.find(ert => Object.is(crrt, ert))))) {
              // VPC endpoint route tables update
              const input: ModifyVpcEndpointCommandInput = {
                VpcEndpointId: e.vpcEndpointId,
                RemoveRouteTableIds: cloudRecord.routeTableIds,
                AddRouteTableIds: e.routeTableIds,
              };
              await modifyVpcEndpointGateway(client.ec2client, input);
              update = true;
            }
            if (!awsVpcModule.eqTags(cloudRecord.tags, e.tags)) {
              // Tags update
              await updateTags(client.ec2client, e.vpcEndpointId ?? '', e.tags);
              update = true;
            }
            if (update) {
              const rawEndpointGateway = await getVpcEndpointGateway(client.ec2client, e.vpcEndpointId ?? '');
              if (!rawEndpointGateway) continue;
              const newEndpointGateway = await awsVpcModule.endpointGatewayMapper(rawEndpointGateway, ctx);
              if (!newEndpointGateway) continue;
              newEndpointGateway.id = e.id;
              await awsVpcModule.endpointGateway.db.update(newEndpointGateway, ctx);
              out.push(newEndpointGateway);
            } else {
              // Restore record
              cloudRecord.id = e.id;
              await awsVpcModule.endpointGateway.db.update(cloudRecord, ctx);
              out.push(cloudRecord);
            }
          } else {
            // Replace record
            const newEndpointGateway = await awsVpcModule.endpointGateway.cloud.create(e, ctx) as EndpointGateway;
            await awsVpcModule.endpointGateway.cloud.delete(cloudRecord, ctx);
            out.push(newEndpointGateway);
          }
        }
        return out;
      },
      delete: async (es: EndpointGateway[], ctx: Context) => {
        const client = await ctx.getAwsClient() as AWS;
        for (const e of es) {
          await deleteVpcEndpointGateway(client.ec2client, e.vpcEndpointId ?? '');
        }
      },
    }),
  })

  availabilityZone: Mapper2<AvailabilityZone> = new Mapper2<AvailabilityZone>({
    entity: AvailabilityZone,
    equals: (a: AvailabilityZone, b: AvailabilityZone) => a.name === b.name,
    source: 'db',
    cloud: new Crud2({
      create: async (e: AvailabilityZone[], ctx: Context) => {
        const out = await awsVpcModule.availabilityZone.db.delete(e, ctx);
        if (out && !(out instanceof Array)) return [out];
        return out;
      },
      read: async (ctx: Context, name?: string) => {
        const client = await ctx.getAwsClient() as AWS;
        const availabilityZones = await getAvailabilityZones(client.ec2client, client.region);
        const azs = availabilityZones
          ?.AvailabilityZones
          ?.filter(az => !!az.ZoneName)
          .map(az => {
            const out = new AvailabilityZone();
            out.name = az.ZoneName as string; // TS should have figured this out from the filter
            return out;
          }) ?? [];
        if (!!name) return azs.filter(az => az.name === name);
        return azs;
      },
      // Update should never happen because the name is the only field
      update: async (_e: AvailabilityZone[], _ctx: Context) => { /* Do nothing */ },
      delete: async (e: AvailabilityZone[], ctx: Context) => {
        const out = await awsVpcModule.availabilityZone.db.create(e, ctx);
        if (out && !(out instanceof Array)) return [out];
        return out;
      },
    }),
  })
}
export const awsVpcModule = new AwsVpcModule();
