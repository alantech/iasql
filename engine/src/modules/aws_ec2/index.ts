import { In, } from 'typeorm'
import { Image, } from '@aws-sdk/client-ec2'

import { AWS, } from '../../services/gateways/aws'
import { AMI, } from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsEc21637043091787, } from './migration/1637043091787-aws_ec2'

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
      out.imageId = ami.ImageId;
      out.description = ami.Description;
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
        create: async (e: AMI | AMI[], ctx: Context) => { await ctx.orm.save(AMI, e); },
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
    postinstall: awsEc21637043091787.prototype.up,
    predown: awsEc21637043091787.prototype.down,
  },
});