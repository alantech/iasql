import {
  EC2,
  Subnet as AwsSubnet,
  paginateDescribeSubnets,
  NetworkAcl as AwsNetworkAcl,
} from '@aws-sdk/client-ec2';

import { AwsVpcModule } from '..';
import { AWS, crudBuilder, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { Subnet, SubnetState } from '../entity';

export class SubnetMapper extends MapperBase<Subnet> {
  module: AwsVpcModule;
  entity = Subnet;
  equals = (a: Subnet, b: Subnet) =>
    Object.is(a.cidrBlock, b.cidrBlock) &&
    Object.is(a?.availabilityZone?.name, b?.availabilityZone?.name) &&
    Object.is(a?.vpc?.vpcId, b?.vpc?.vpcId) &&
    Object.is(a.networkAcl?.networkAclId, b.networkAcl?.networkAclId);

  getNetworkAclBySubnet = crudBuilderFormat<EC2, 'describeNetworkAcls', AwsNetworkAcl | undefined>(
    'describeNetworkAcls',
    subnetId => ({
      Filters: [
        {
          Name: 'association.subnet-id',
          Values: [subnetId],
        },
      ],
    }),
    res => res?.NetworkAcls?.pop(),
  );

  async getAssociation(client: EC2, subnetId: string) {
    const networkAcl = await this.getNetworkAclBySubnet(client, subnetId);
    for (const association of networkAcl?.Associations ?? []) {
      if (association.SubnetId === subnetId && association.NetworkAclId) return association;
    }
    return undefined;
  }

  async subnetMapper(sn: AwsSubnet, ctx: Context, region: string) {
    const out = new Subnet();
    if (!sn?.SubnetId || !sn?.VpcId) return undefined;
    out.state = sn.State as SubnetState;
    if (!sn.AvailabilityZone) return undefined;
    out.availabilityZone =
      (await this.module.availabilityZone.db.read(
        ctx,
        this.module.availabilityZone.generateId({ name: sn.AvailabilityZone, region }),
      )) ??
      (await this.module.availabilityZone.cloud.read(
        ctx,
        this.module.availabilityZone.generateId({ name: sn.AvailabilityZone, region }),
      ));
    out.vpc =
      (await this.module.vpc.db.read(ctx, this.module.vpc.generateId({ vpcId: sn.VpcId, region }))) ??
      (await this.module.vpc.cloud.read(ctx, this.module.vpc.generateId({ vpcId: sn.VpcId, region })));
    if (sn.VpcId && !out.vpc) throw new Error(`Waiting for VPC ${sn.VpcId}`);
    out.availableIpAddressCount = sn.AvailableIpAddressCount;
    out.cidrBlock = sn.CidrBlock;
    out.subnetId = sn.SubnetId;
    out.ownerId = sn.OwnerId;
    out.subnetArn = sn.SubnetArn;
    out.region = region;

    // retrieve the acls
    const client = (await ctx.getAwsClient(region)) as AWS;
    const association = await this.getAssociation(client.ec2client, sn.SubnetId);
    if (association && association.NetworkAclId) {
      out.networkAcl =
        (await this.module.networkAcl.db.read(
          ctx,
          this.module.networkAcl.generateId({ networkAclId: association.NetworkAclId, region }),
        )) ??
        (await this.module.networkAcl.cloud.read(
          ctx,
          this.module.networkAcl.generateId({ networkAclId: association.NetworkAclId, region }),
        ));
    }
    return out;
  }

  createSubnet = crudBuilder<EC2, 'createSubnet'>('createSubnet', input => input);
  getSubnet = crudBuilderFormat<EC2, 'describeSubnets', AwsSubnet | undefined>(
    'describeSubnets',
    id => ({ SubnetIds: [id] }),
    res => res?.Subnets?.[0],
  );
  getSubnets = paginateBuilder<EC2>(paginateDescribeSubnets, 'Subnets');
  deleteSubnet = crudBuilder<EC2, 'deleteSubnet'>('deleteSubnet', input => input);
  replaceNetworkAclAssociation = crudBuilder<EC2, 'replaceNetworkAclAssociation'>(
    'replaceNetworkAclAssociation',
    input => input,
  );

  cloud: Crud<Subnet> = new Crud({
    create: async (es: Subnet[], ctx: Context) => {
      // TODO: Add support for creating default subnets (only one is allowed, also add
      // constraint that a single subnet is set as default)
      const out = [];
      for (const e of es) {
        const region = e.region;
        const client = (await ctx.getAwsClient(e.region)) as AWS;

        // check if we need to read vpc id again
        const input: any = {
          AvailabilityZone: e.availabilityZone.name,
          VpcId: e.vpc.vpcId,
        };
        if (e.cidrBlock) input.CidrBlock = e.cidrBlock;
        const res = await this.createSubnet(client.ec2client, input);
        if (!res?.Subnet) throw new Error('Failed to create subnet');

        const rawSubnet = await this.getSubnet(client.ec2client, res.Subnet.SubnetId);
        if (!rawSubnet) continue;

        // if we do not have the matching ACL we wait until we have
        let newSubnet = await this.subnetMapper(rawSubnet, ctx, e.region);
        if (!newSubnet) continue;
        const acl = await this.module.networkAcl.db.read(ctx, newSubnet.networkAcl?.networkAclId);
        if (!acl) continue;
        newSubnet.id = e.id;

        // retrieve the current association for acl and check if that's different
        if (e.networkAcl?.networkAclId && newSubnet.subnetId) {
          const association = await this.getAssociation(client.ec2client, newSubnet.subnetId);
          if (association && association.NetworkAclAssociationId) {
            // trigger a replacement
            const aclInput = {
              AssociationId: association.NetworkAclAssociationId,
              NetworkAclId: e.networkAcl?.networkAclId,
            };
            await this.replaceNetworkAclAssociation(client.ec2client, aclInput);

            // read record again to get generated ACL
            delete ctx.memo.cloud.Subnet[this.entityId(e)];
            const rawSubnet1 = await this.getSubnet(client.ec2client, newSubnet.subnetId);
            if (!rawSubnet1) continue;

            newSubnet = await this.subnetMapper(rawSubnet1, ctx, e.region);
          }
        }
        if (!newSubnet) continue;
        newSubnet.id = e.id;

        await this.module.subnet.db.update(newSubnet, ctx);
        out.push(newSubnet);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      // TODO: Convert AWS subnet representation to our own
      if (!!id) {
        const { subnetId, region } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawSubnet = await this.getSubnet(client.ec2client, subnetId);
          if (rawSubnet) return await this.subnetMapper(rawSubnet, ctx, region);
        }
      } else {
        const out: Subnet[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            for (const sn of await this.getSubnets(client.ec2client)) {
              const outSn = await this.subnetMapper(sn, ctx, region);
              if (outSn) out.push(outSn);
            }
          }),
        );
        return out;
      }
    },
    update: async (es: Subnet[], ctx: Context) => {
      // There is no update mechanism for a subnet so instead we will create a new one and the
      // next loop through should delete the old one
      const out = [];
      for (const e of es) {
        const cloudRecord =
          ctx?.memo?.cloud?.Subnet?.[this.entityId(e)] ??
          (await this.module.subnet.cloud.read(ctx, this.entityId(e)));
        const client = (await ctx.getAwsClient(e.region)) as AWS;

        // if only acl changed we can replace it
        if (
          e.networkAcl?.networkAclId !== cloudRecord?.networkAcl?.networkAclId &&
          Object.is(e.cidrBlock, cloudRecord.cidrBlock) &&
          Object.is(e?.availabilityZone?.name, cloudRecord?.availabilityZone?.name) &&
          Object.is(e?.vpc?.vpcId, cloudRecord?.vpc?.vpcId)
        ) {
          if (!e.networkAcl?.networkAclId && e.subnetId) {
            // just restore the values and continue
            e.networkAcl = cloudRecord?.networkAcl;
            await this.db.update(e, ctx);
            out.push(e);
            continue;
          } else {
            const association = await this.getAssociation(client.ec2client, e.subnetId!);
            if (association) {
              // trigger a replacement
              const input = {
                AssociationId: association.NetworkAclAssociationId,
                NetworkAclId: e.networkAcl?.networkAclId,
              };
              await this.replaceNetworkAclAssociation(client.ec2client, input);

              // query record again to get updated results
              delete ctx.memo.cloud.Subnet[this.entityId(e)];
              const rawSubnet = await this.getSubnet(client.ec2client, e.subnetId);
              if (!rawSubnet) continue;

              const newSubnet = await this.subnetMapper(rawSubnet, ctx, e.region);
              if (!newSubnet) continue;

              newSubnet.id = e.id;
              await this.db.update(newSubnet, ctx);
            }
            out.push(e);
          }
        } else {
          if (cloudRecord?.vpc?.vpcId !== e.vpc?.vpcId) {
            // If vpc changes we need to take into account the one from the `cloudRecord` since it will be the most updated one
            e.vpc = cloudRecord.vpc;
            e.networkAcl = undefined;
          }
          const newSubnet = await this.module.subnet.cloud.create(e, ctx);

          // need to query for subnet updates as acl may have changed
          if (newSubnet && !Array.isArray(newSubnet)) {
            const rawSubnet = await this.getSubnet(client.ec2client, newSubnet.subnetId);
            if (!rawSubnet) continue;

            const newSubnet1 = await this.subnetMapper(rawSubnet, ctx, e.region);
            if (!newSubnet1) continue;

            newSubnet1.id = e.id;
            await this.db.update(newSubnet1, ctx);

            out.push(newSubnet1);
          }
        }
      }
      return out;
    },
    delete: async (es: Subnet[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        // Special behavior here. You're not allowed to mess with the "default" VPC or its subnets.
        // Any attempt to update it is instead turned into *restoring* the value in
        // the database to match the cloud value
        if (e.vpc?.isDefault) {
          // For delete, we have un-memoed the record, but the record passed in *is* the one
          // we're interested in, which makes it a bit simpler here
          const vpc =
            ctx?.memo?.db?.Vpc[
              this.module.vpc.generateId({ vpcId: e.vpc.vpcId ?? '', region: e.vpc.region })
            ] ?? null;
          e.vpc.id = vpc.id;
          await this.module.subnet.db.update(e, ctx);
          // Make absolutely sure it shows up in the memo
          ctx.memo.db.Subnet[this.entityId(e)] = e;
        } else {
          await this.deleteSubnet(client.ec2client, {
            SubnetId: e.subnetId,
          });
        }
      }
    },
  });

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
