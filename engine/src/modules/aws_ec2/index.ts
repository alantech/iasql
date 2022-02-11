import { InstanceTypeInfo, Instance as InstanceAWS, } from '@aws-sdk/client-ec2'
import { In, } from 'typeorm'

import * as allEntities from './entity'
import {
  BootMode,
  CPUArchitecture,
  DeviceType,
  DiskInfo,
  DiskType,
  EBSEncryptionSupport,
  EBSInfo,
  EBSOptimizedInfo,
  EBSOptimizedSupport,
  EFAInfo,
  ENASupport,
  EphemeralNVMESupport,
  FPGADeviceInfo,
  FPGADeviceMemoryInfo,
  FPGAInfo,
  GPUDeviceInfo,
  GPUDeviceMemoryInfo,
  GPUInfo,
  InferenceAcceleratorInfo,
  InferenceDeviceInfo,
  Instance,
  InstanceStorageInfo,
  InstanceType,
  InstanceTypeHypervisor,
  NetworkCardInfo,
  NetworkInfo,
  PlacementGroupInfo,
  PlacementGroupStrategy,
  ProcessorInfo,
  UsageClass,
  VCPUInfo,
  ValidCore,
  ValidThreadsPerCore,
  VirtualizationType,
} from './entity'
import { AwsSecurityGroupModule, } from '../aws_security_group'
import { AWS, IASQL_EC2_TAG_NAME } from '../../services/gateways/aws'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsEc21644618103194 } from './migration/1644618103194-aws_ec2'

export const AwsEc2Module: Module = new Module({
  name: 'aws_ec2',
  dependencies: ['aws_account', 'aws_security_group'],
  provides: {
    entities: allEntities,
    tables: [
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
    instanceTypeMapper: (instanceType: InstanceTypeInfo) => {
      const out = new InstanceType();
      out.autoRecoverySupported = instanceType.AutoRecoverySupported ?? false;
      out.availabilityZones = []; // TODO: Where does this come from?
      out.bareMetal = instanceType.BareMetal ?? false;
      out.burstablePerformanceSupported = instanceType.BurstablePerformanceSupported ?? false;
      out.currentGeneration = instanceType.CurrentGeneration ?? false;
      out.dedicatedHostsSupported = instanceType.DedicatedHostsSupported ?? false;
      if (instanceType.EbsInfo) {
        const i2 = instanceType.EbsInfo;
        const o2 = new EBSInfo();
        out.ebsInfo = o2;
        if (i2.EbsOptimizedInfo) {
          const i3 = i2.EbsOptimizedInfo;
          const o3 = new EBSOptimizedInfo();
          o2.ebsOptimizedInfo = o3;
          o3.baselineBandwidthInMbps = i3.BaselineBandwidthInMbps ?? 0;
          o3.baselineIOPS = i3.BaselineIops ?? 0;
          o3.baselineThroughputInMBps = i3.BaselineThroughputInMBps ?? 0;
          o3.maximumBandwidthInMbps = i3.MaximumBandwidthInMbps ?? 0;
          o3.maximumIOPS = i3.MaximumIops ?? 0;
          o3.maximumThroughputInMBps = i3.MaximumThroughputInMBps ?? 0;
        }
        if (i2.EbsOptimizedSupport) o2.ebsOptimizedSupport = i2.EbsOptimizedSupport as EBSOptimizedSupport;
        if (i2.EncryptionSupport) o2.encryptionSupport = i2.EncryptionSupport as EBSEncryptionSupport;
        if (i2.NvmeSupport) o2.NVMESupport = i2.NvmeSupport as EphemeralNVMESupport;
      }
      if (instanceType.FpgaInfo) {
        const i2 = instanceType.FpgaInfo;
        const o2 = new FPGAInfo();
        out.fpgaInfo = o2;
        o2.fpgas = i2.Fpgas?.map(f => {
          const o3 = new FPGADeviceInfo();
          o3.count = f.Count ?? 0;
          o3.manufacturer = f.Manufacturer ?? '';
          if (f.MemoryInfo) {
            const i4 = f.MemoryInfo;
            const o4 = new FPGADeviceMemoryInfo();
            o3.memoryInfo = o4;
            o4.sizeInMiB = i4.SizeInMiB ?? 0;
          }
          o3.name = f.Name ?? '';
          return o3;
        }) ?? [];
        o2.totalFPGAMemoryInMiB = i2.TotalFpgaMemoryInMiB ?? 0;
      }
      out.freeTierEligible = instanceType.FreeTierEligible ?? false;
      if (instanceType.GpuInfo) {
        const i2 = instanceType.GpuInfo;
        const o2 = new GPUInfo();
        out.gpuInfo = o2;
        o2.gpus = i2.Gpus?.map(g => {
          const o3 = new GPUDeviceInfo();
          o3.count = g.Count ?? 0;
          o3.manufacturer = g.Manufacturer ?? '';
          if (g.MemoryInfo) {
            const i4 = g.MemoryInfo;
            const o4 = new GPUDeviceMemoryInfo();
            o3.memoryInfo = o4;
            o4.sizeInMiB = i4.SizeInMiB ?? 0;
          }
          o3.name = g.Name ?? '';
          return o3;
        }) ?? [];
        o2.totalGPUMemoryInMiB = i2.TotalGpuMemoryInMiB ?? 0;
      }
      out.hibernationSupported = instanceType.HibernationSupported ?? false;
      if (instanceType.Hypervisor) out.hypervisor = instanceType.Hypervisor as InstanceTypeHypervisor;
      if (instanceType.InferenceAcceleratorInfo) {
        const i2 = instanceType.InferenceAcceleratorInfo;
        const o2 = new InferenceAcceleratorInfo();
        out.inferenceAcceleratorInfo = o2;
        o2.accelerators = i2.Accelerators?.map(a => {
          const o3 = new InferenceDeviceInfo();
          o3.count = a.Count ?? 0;
          o3.manufacturer = a.Manufacturer ?? '';
          o3.name = a.Name ?? '';
          return o3;
        }) ?? [];
      }
      out.instances = []; // TODO: Add this once instance mapper written
      if (instanceType.InstanceStorageInfo) {
        const i2 = instanceType.InstanceStorageInfo;
        const o2 = new InstanceStorageInfo();
        out.instanceStorageInfo = o2;
        o2.disks = i2.Disks?.map(d => {
          const o3 = new DiskInfo();
          o3.count = d.Count ?? 0;
          if (d.Type) o3.diskType = d.Type as DiskType;
          o3.sizeInGB = d.SizeInGB ?? 0;
          return o3;
        }) ?? [];
        if (i2.NvmeSupport) o2.NVMESupport = i2.NvmeSupport as EphemeralNVMESupport;
        o2.totalSizeInGB = i2.TotalSizeInGB ?? 0;
      }
      out.instanceStorageSupported = instanceType.InstanceStorageSupported ?? false;
      if (instanceType.InstanceType) {
        out.name = instanceType.InstanceType;
      }
      out.memorySizeInMiB = instanceType.MemoryInfo?.SizeInMiB ?? 0;
      if (instanceType.NetworkInfo) {
        const i2 = instanceType.NetworkInfo;
        const o2 = new NetworkInfo();
        out.networkInfo = o2;
        o2.defaultNetworkCardIndex = i2.DefaultNetworkCardIndex ?? 0;
        if (i2.EfaInfo) {
          const i3 = i2.EfaInfo;
          const o3 = new EFAInfo();
          o2.efaInfo = o3;
          o3.maximumEFAInterfaces = i3.MaximumEfaInterfaces ?? 0;
        }
        o2.efaSupported = i2.EfaSupported ?? false;
        if (i2.EnaSupport) o2.enaSupport = i2.EnaSupport as ENASupport;
        o2.encryptionInTransitSupported = i2.EncryptionInTransitSupported ?? false;
        o2.ipv4AddressesPerInterface = i2.Ipv4AddressesPerInterface ?? 0;
        o2.ipv6AddressesPerInterface = i2.Ipv6AddressesPerInterface ?? 0;
        o2.ipv6Supported = i2.Ipv6Supported ?? false;
        o2.maximumNetworkCards = i2.MaximumNetworkCards ?? 0;
        o2.maximumNetworkInterfaces = i2.MaximumNetworkInterfaces ?? 0;
        o2.networkCards = i2.NetworkCards?.map(n => {
          const o3 = new NetworkCardInfo();
          o3.maximumNetworkInterfaces = n.MaximumNetworkInterfaces ?? 0;
          o3.networkCardIndex = n.NetworkCardIndex ?? 0;
          o3.networkPerformance = n.NetworkPerformance ?? '';
          return o3;
        }) ?? [];
        o2.networkPerformance = i2.NetworkPerformance ?? '';
      }
      if (instanceType.PlacementGroupInfo) {
        const i2 = instanceType.PlacementGroupInfo;
        const o2 = new PlacementGroupInfo();
        out.placementGroupInfo = o2;
        o2.supportedStrategies = i2.SupportedStrategies?.map(s => {
          const o3 = new PlacementGroupStrategy();
          o3.strategy = s;
          return o3;
        }) ?? [];
      }
      if (instanceType.ProcessorInfo) {
        const i2 = instanceType.ProcessorInfo;
        const o2 = new ProcessorInfo();
        out.processorInfo = o2;
        o2.supportedArchitectures = i2.SupportedArchitectures?.map(a => {
          const o3 = new CPUArchitecture();
          o3.cpuArchitecture = a;
          return o3;
        }) ?? [];
        o2.sustainedClockSpeedInGHz = i2.SustainedClockSpeedInGhz ?? 0;
      }
      out.regions = []; // TODO: How to determine this?
      out.supportedBootModes = instanceType.SupportedBootModes?.map(bm => {
        const o2 = new BootMode();
        o2.mode = bm;
        return o2;
      }) ?? [];
      out.supportedRootDeviceTypes = instanceType.SupportedRootDeviceTypes?.map(rdt => {
        const o2 = new DeviceType();
        o2.deviceType = rdt;
        return o2;
      }) ?? [];
      out.supportedUsageClasses = instanceType.SupportedUsageClasses?.map(uc => {
        const o2 = new UsageClass();
        o2.usageClass = uc;
        return o2;
      }) ?? [];
      out.supportedVirtualizationTypes = instanceType.SupportedVirtualizationTypes?.map(vt => {
        const o2 = new VirtualizationType();
        o2.virtualizationType = vt;
        return o2;
      }) ?? [];
      if (instanceType.VCpuInfo) {
        const i2 = instanceType.VCpuInfo;
        const o2 = new VCPUInfo();
        out.vCPUInfo = o2;
        o2.defaultCores = i2.DefaultCores ?? 0;
        o2.defaultThreadsPerCore = i2.DefaultThreadsPerCore ?? 0;
        o2.defaultVCPUs = i2.DefaultVCpus ?? 0;
        o2.validCores = i2.ValidCores?.map(vc => {
          const o3 = new ValidCore();
          o3.count = vc;
          return o3;
        }) ?? [];
        o2.validThreadsPerCore = i2.ValidThreadsPerCore?.map(vtc => {
          const o3 = new ValidThreadsPerCore();
          o3.count = vtc;
          return o3;
        }) ?? [];
      }
      return out;
    },
    instanceMapper: async (instance: InstanceAWS, ctx: Context) => {
      const out = new Instance();
      out.instanceId = instance.InstanceId;
      // for instances created outside IaSQL, set the name to the instance ID
      out.name = instance.Tags?.filter(t => t.Key === IASQL_EC2_TAG_NAME && t.Value !== undefined).pop()?.Value ?? (instance.InstanceId ?? '');
      out.ami = instance.ImageId ?? '';
      out.instanceType = await AwsEc2Module.mappers.instanceType.db.read(ctx, instance.InstanceType);
      if (!out.instanceType) throw new Error('Cannot create Instance object without a valid InstanceType in the Database');
      out.securityGroups = await AwsSecurityGroupModule.mappers.securityGroup.db.read(
        ctx,
        instance.SecurityGroups?.map(sg => sg.GroupId).filter(id => !!id) as string[],
      );
      return out;
    },
  },
  mappers: {
    instanceType: new Mapper<InstanceType>({
      entity: InstanceType,
      entityId: (e: InstanceType) => e.name,
      // TODO: source: cloud entityPrint not needed (yet)
      entityPrint: (e: InstanceType) => ({
        id: e.id?.toString() ?? '',
      }),
      equals: (a: InstanceType, b: InstanceType) => a.name === b.name, // TODO
      source: 'cloud',
      db: new Crud({
        create: async (es: InstanceType[], ctx: Context) => {
          // Deduplicate several sub-objects ahead of time, preserving an ID if it exists
          const fpgas: { [key: string]: FPGADeviceInfo, } = {};
          const gpus: { [key: string]: GPUDeviceInfo, } = {};
          const accelerators: { [key: string]: InferenceDeviceInfo, } = {};
          const strategies: { [key: string]: PlacementGroupStrategy, } = {};
          const cpuArches: { [key: string]: CPUArchitecture, } = {};
          const bootModes: { [key: string]: BootMode, } = {};
          const rootTypeDevices: { [key: string]: DeviceType, } = {};
          const usageClasses: { [key: string]: UsageClass, } = {};
          const virtualizationTypes: { [key: string]: VirtualizationType, } = {};
          es.forEach((entity: InstanceType) => {
            if (entity.fpgaInfo) {
              entity.fpgaInfo.fpgas.forEach((f, i) => {
                const name = f.name;
                fpgas[name] = fpgas[name] ?? f;
                entity.fpgaInfo.fpgas[i] = fpgas[name];
              });
            }
            if (entity.gpuInfo) {
              entity.gpuInfo.gpus.forEach((g, i) => {
                const name = g.name;
                gpus[name] = gpus[name] ?? g;
                entity.gpuInfo.gpus[i] = gpus[name];
              });
            }
            if (entity.inferenceAcceleratorInfo) {
              entity.inferenceAcceleratorInfo.accelerators.forEach((a, i) => { // We have true A I!
                const name = a.name;
                accelerators[name] = accelerators[name] ?? a;
                entity.inferenceAcceleratorInfo.accelerators[i] = accelerators[name];
              });
            }
            if (entity.placementGroupInfo) {
              entity.placementGroupInfo.supportedStrategies.forEach((s, i) => {
                const strat = s.strategy;
                strategies[strat] = strategies[strat] ?? s;
                entity.placementGroupInfo.supportedStrategies[i] = strategies[strat];
              });
            }
            if (entity.processorInfo) {
              entity.processorInfo.supportedArchitectures.forEach((a, i) => {
                const arch = a.cpuArchitecture;
                cpuArches[arch] = cpuArches[arch] ?? a;
                entity.processorInfo.supportedArchitectures[i] = cpuArches[arch];
              });
            }
            if (entity.supportedBootModes) {
              entity.supportedBootModes.forEach((b, i) => {
                const { mode, } = b;
                bootModes[mode] = bootModes[mode] ?? b;
                entity.supportedBootModes[i] = bootModes[mode];
              });
            }
            if (entity.supportedRootDeviceTypes) {
              entity.supportedRootDeviceTypes.forEach((r, i) => {
                const { deviceType, } = r;
                rootTypeDevices[deviceType] = rootTypeDevices[deviceType] ?? r;
                entity.supportedRootDeviceTypes[i] = rootTypeDevices[deviceType];
              });
            }
            if (entity.supportedUsageClasses) {
              entity.supportedUsageClasses.forEach((u, i) => {
                const { usageClass, } = u;
                usageClasses[usageClass] = usageClasses[usageClass] ?? u;
                entity.supportedUsageClasses[i] = usageClasses[usageClass];
              });
            }
            if (entity.supportedVirtualizationTypes) {
              entity.supportedVirtualizationTypes.forEach((v, i) => {
                const { virtualizationType, } = v;
                virtualizationTypes[virtualizationType] = virtualizationTypes[virtualizationType] ?? v;
                entity.supportedVirtualizationTypes[i] = virtualizationTypes[virtualizationType];
              });
            }
          });
          // Pre-save these sub-records first
          await ctx.orm.save(FPGADeviceInfo, Object.values(fpgas));
          await ctx.orm.save(GPUDeviceInfo, Object.values(gpus));
          await ctx.orm.save(InferenceDeviceInfo, Object.values(accelerators));
          await ctx.orm.save(PlacementGroupStrategy, Object.values(strategies));
          await ctx.orm.save(CPUArchitecture, Object.values(cpuArches));
          await ctx.orm.save(BootMode, Object.values(bootModes));
          await ctx.orm.save(DeviceType, Object.values(rootTypeDevices));
          await ctx.orm.save(UsageClass, Object.values(usageClasses));
          await ctx.orm.save(VirtualizationType, Object.values(virtualizationTypes));
          // Now save the InstanceType records
          await ctx.orm.save(InstanceType, es);
        },
        read: async (ctx: Context, ids?: string[]) => {
          // TypeORM where clause not working correctly, again
          ids = Array.isArray(ids) ? ids : [];
          const allInstances = await ctx.orm.find(InstanceType);
          return allInstances.filter((i: InstanceType) => (ids as string[]).includes(i.name));
        },
        update: (e: InstanceType[], ctx: Context) => ctx.orm.save(InstanceType, e),
        delete: (e: InstanceType[], ctx: Context) => ctx.orm.remove(InstanceType, e),
      }),
      cloud: new Crud({
        create: async (_i: InstanceType[], _ctx: Context) => { /* Do nothing, not allowed */ },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const instanceTypes = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getInstanceType(id))) :
            (await client.getInstanceTypes()).InstanceTypes ?? [];
          return instanceTypes.map(AwsEc2Module.utils.instanceTypeMapper);
        },
        update: async (_i: InstanceType[], _ctx: Context) => { /* Nope */ },
        delete: async (_i: InstanceType[], _ctx: Context) => { /* Nope */ },
      }),
    }),
    instance: new Mapper<Instance>({
      entity: Instance,
      entityId: (i: Instance) => i.name,
      entityPrint: (e: Instance) => ({
        name: e.name,
        id: e.id?.toString() ?? '',
        instanceId: e.instanceId ?? '',
        ami: e.ami ?? '',
        instanceType: e.instanceType?.name ?? '',
        securityGroups: e.securityGroups?.map(sg => sg.groupName ?? '').join(', '),
      }),
      equals: (a: Instance, b: Instance) => Object.is(a.name, b.name),
      source: 'db',
      db: new Crud({
        create: (e: Instance[], ctx: Context) => ctx.orm.save(Instance, e),
        read: (ctx: Context, ids?: string[]) => ctx.orm.find(Instance, ids ? {
          where: {
            instanceId: In(ids),
          },
        } : undefined),
        update: (e: Instance[], ctx: Context) => ctx.orm.save(Instance, e),
        delete: (e: Instance[], ctx: Context) => ctx.orm.remove(Instance, e),
      }),
      cloud: new Crud({
        create: async (es: Instance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const instance of es) {
            if (instance.ami) {
              const instanceId = await client.newInstance(
                instance.name,
                instance.instanceType.name,
                instance.ami,
                instance.securityGroups.map(sg => sg.groupId).filter(id => !!id) as string[],
              );
              if (!instanceId) { // then who?
                throw new Error('should not be possible');
              }
              instance.instanceId = instanceId;
              await AwsEc2Module.mappers.instance.db.update(instance, ctx);
            }
          }
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const instances = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getInstance(id))) :
            (await client.getInstances()).Instances ?? [];
          // ignore instances in "Terminated" and "Shutting down" state
          return await Promise.all(instances
            .filter(i => i?.State?.Name !== "terminated" && i?.State?.Name !== "shutting-down")
            .map(i => AwsEc2Module.utils.instanceMapper(i, ctx))
          );
        },
        // The second pass should remove the old instances
        update: (e: Instance[], ctx: Context) => AwsEc2Module.mappers.instance.cloud.create(e, ctx),
        delete: async (es: Instance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const entity of es) {
            if (entity.instanceId) await client.terminateInstance(entity.instanceId);
          }
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsEc21644618103194.prototype.up,
    preremove: awsEc21644618103194.prototype.down,
  },
});