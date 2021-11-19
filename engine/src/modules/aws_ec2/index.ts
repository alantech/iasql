import { In, Table, } from 'typeorm'
import { Image, } from '@aws-sdk/client-ec2'

import { AWS, } from '../../services/gateways/aws'
import {
  AMI,
  CPUArchitecture,
  ImageType,
  AMIPlatform,
  ProductCode,
  AMIImageState,
  EBSBlockDeviceMapping,
  EBSBlockDeviceType,
  EBSBlockDeviceVolumeType,
  HypervisorType,
  AMIDeviceType,
  StateReason,
  BootMode,
  Tag,
} from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsEc21637358975142, } from './migration/1637358975142-aws_ec2'

export const AwsEc2Module: Module = new Module({
  name: 'aws_ec2',
  dependencies: ['aws_account', 'aws_security_group'],
  provides: {
    entities: allEntities,
    tables: [
      'ami',
      'ami_block_device_mappings_ebs_block_device_mapping',
      'ami_product_codes_product_code',
      'ami_tags_tag',
      'boot_mode',
      'cpu_architecture',
      'device_type',
      'disk_info',
      'ebs_block_device_mapping',
      'ebs_block_device_type',
      'ebs_info',
      'ebs_optimized_info',
      'efa_info',
      'fpga_device_info',
      'fpga_device_memory_info',
      'fpga_info',
      'fpga_info_fpgas_fpga_device_info',
      'gpu_device_info',
      'gpu_device_memory_info',
      'gpu_info',
      'gpu_info_gpus_gpu_device_info',
      'inference_accelerator_info',
      'inference_accelerator_info_accelerators_inference_device_info',
      'inference_device_info',
      'ins_typ_sup_vir_typ_vir_typ',
      'instance',
      'instance_security_groups_aws_security_group',
      'instance_storage_info',
      'instance_storage_info_disks_disk_info',
      'instance_type',
      'instance_type_availability_zones_availability_zone',
      'instance_type_regions_region',
      'instance_type_supported_boot_modes_boot_mode',
      'instance_type_supported_root_device_types_device_type',
      'instance_type_supported_usage_classes_usage_class',
      'instance_type_value',
      'network_card_info',
      'network_info',
      'network_info_network_cards_network_card_info',
      'pla_gro_inf_sup_str_pla_gro_str',
      'placement_group_info',
      'placement_group_strategy',
      'processor_info',
      'processor_info_supported_architectures_cpu_architecture',
      'product_code',
      'state_reason',
      'tag',
      'usage_class',
      'valid_core',
      'valid_threads_per_core',
      'vcpu_info',
      'vcpu_info_valid_cores_valid_core',
      'vcpu_info_valid_threads_per_core_valid_threads_per_core',
      'virtualization_type',
    ],
  },
  utils: {
    amiMapper: async (ami: Image, _ctx: Context) => {
      const out = new AMI();
      if (ami.Architecture) {
        out.cpuArchitecture = new CPUArchitecture();
        out.cpuArchitecture.cpuArchitecture = ami.Architecture;
      }
      if (ami.CreationDate) out.creationDate = new Date(ami.CreationDate);
      out.imageId = ami.ImageId;
      out.imageLocation = ami.ImageLocation;
      if (ami.ImageType) out.imageType = ami.ImageType as ImageType;
      out.public = ami.Public;
      out.kernelId = ami.KernelId;
      out.ownerId = ami.OwnerId;
      if (ami.Platform) out.platform = ami.Platform as AMIPlatform;
      out.platformDetails = ami.PlatformDetails;
      out.usageOperation = ami.UsageOperation;
      out.productCodes = ami.ProductCodes?.map(pc => {
        const o2 = new ProductCode();
        o2.productCodeId = pc.ProductCodeId;
        o2.productCodeType = pc.ProductCodeType;
        return o2;
      }) ?? [];
      out.ramdiskId = ami.RamdiskId;
      if (ami.State) out.state = ami.State as AMIImageState;
      out.blockDeviceMappings = ami.BlockDeviceMappings?.map(bdm => {
        const o3 = new EBSBlockDeviceMapping();
        o3.deviceName = bdm.DeviceName;
        if (bdm.Ebs) {
          o3.ebs = new EBSBlockDeviceType();
          o3.ebs.deleteOnTermination = bdm.Ebs?.DeleteOnTermination;
          o3.ebs.encrypted = bdm.Ebs?.Encrypted;
          o3.ebs.iops = bdm.Ebs?.Iops;
          o3.ebs.kmsKeyId = bdm.Ebs?.KmsKeyId;
          o3.ebs.outpostArn = bdm.Ebs?.OutpostArn;
          o3.ebs.snapshotId = bdm.Ebs?.SnapshotId;
          o3.ebs.throughput = bdm.Ebs?.Throughput;
          o3.ebs.volumeSize = bdm.Ebs?.VolumeSize;
          if (bdm.Ebs?.VolumeType) o3.ebs.volumeType = bdm.Ebs?.VolumeType as EBSBlockDeviceVolumeType;
        }
        o3.noDevice = bdm.NoDevice;
        o3.virtualName = bdm.VirtualName;
        return o3;
      }) ?? [];
      out.description = ami.Description;
      out.enaSupport = ami.EnaSupport;
      if (ami.Hypervisor) out.hypervisor = ami.Hypervisor as HypervisorType;
      out.imageOwnerAlias = ami.ImageOwnerAlias;
      out.name = ami.Name;
      out.rootDeviceName = ami.RootDeviceName;
      if (ami.RootDeviceType) out.rootDeviceType = ami.RootDeviceType as AMIDeviceType;
      out.sriovNetSupport = ami.SriovNetSupport;
      if (ami.StateReason) out.stateReason = ami.StateReason as StateReason;
      if (ami.BootMode) {
        out.bootMode = new BootMode();
        out.bootMode.mode = ami.BootMode;
      }
      if (ami.DeprecationTime) out.deprecationTime = new Date(ami.DeprecationTime)
      out.tags = ami.Tags?.map(t => {
        const o4 = new Tag();
        if (t.Key) o4.key = t.Key;
        if (t.Value) o4.value = t.Value;
        return o4;
      }) ?? [];
      // TODO: Attach instances once we have the mapper for them
      return out;
    },
  },
  mappers: {
    ami: new Mapper<AMI>({
      entity: AMI,
      entityId: (e: AMI) => e.imageId ?? '',
      equals: (a: AMI, b: AMI) => Object.is(a.imageId, b.imageId),
      source: 'cloud',
      db: new Crud({
        create: async (e: AMI | AMI[], ctx: Context) => {
          const es = Array.isArray(e) ? e : [e];
          for (const entity of es) {
            if (entity.cpuArchitecture) {
              const cpuarches = await ctx.orm.find(CPUArchitecture)
              const cpuarch = cpuarches.find((cpua: CPUArchitecture) =>
                cpua.cpuArchitecture === entity.cpuArchitecture.cpuArchitecture
              );
              if (cpuarch) {
                entity.cpuArchitecture.id = cpuarch.id;
              }
            }
            if (entity.bootMode) {
              const bootmodes = await ctx.orm.find(BootMode)
              const bootmode = bootmodes.find((bt: BootMode) =>
                bt.mode === entity.bootMode.mode
              );
              if (bootmode) {
                entity.bootMode.id = bootmode.id;
              }
            }
            await ctx.orm.save(AMI, entity);
          }
        },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          return await ctx.orm.find(AMI, id ? {
            where: {
              groupId: Array.isArray(id) ? In(id) : id,
            },
          } : undefined);
        },
        update: async (e: AMI | AMI[], ctx: Context) => { await ctx.orm.save(AMI, e); },
        delete: async (e: AMI | AMI[], ctx: Context) => { await ctx.orm.remove(AMI, e); },
      }),
      cloud: new Crud({
        create: async (_ami: AMI | AMI[], _ctx: Context) => { /* Do nothing, not allowed */ },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            if (Array.isArray(ids)) {
              return await Promise.all(ids.map(async (id) => {
                return await AwsEc2Module.utils.amiMapper(
                  await client.getAMI(id), ctx
                );
              }));
            } else {
              return await AwsEc2Module.utils.amiMapper(
                await client.getAMI(ids), ctx
              );
            }
          } else {
            const amis = (await client.getAMIs())?.Images ?? [];
            return await Promise.all(
              amis.map((sg: any) => AwsEc2Module.utils.amiMapper(sg, ctx))
            );
          }
        },
        update: async (_ami: AMI | AMI[], _ctx: Context) => { /* Nope */ },
        delete: async (_ami: AMI | AMI[], _ctx: Context) => { /* Nope */ },
      }),
    }),
  },
  migrations: {
    postinstall: awsEc21637358975142.prototype.up,
    preremove: awsEc21637358975142.prototype.down,
  },
});