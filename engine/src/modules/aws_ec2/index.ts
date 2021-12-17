import { Image, InstanceTypeInfo, Instance as InstanceAWS, } from '@aws-sdk/client-ec2'
import { In, } from 'typeorm'

import * as allEntities from './entity'
import {
  AMI,
  AMIDeviceType,
  AMIImageState,
  AMIPlatform,
  BootMode,
  CPUArchitecture,
  DeviceType,
  DiskInfo,
  DiskType,
  EBSBlockDeviceMapping,
  EBSBlockDeviceType,
  EBSBlockDeviceVolumeType,
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
  HypervisorType,
  ImageType,
  InferenceAcceleratorInfo,
  InferenceDeviceInfo,
  Instance,
  InstanceStorageInfo,
  InstanceType,
  InstanceTypeHypervisor,
  InstanceTypeValue,
  NetworkCardInfo,
  NetworkInfo,
  PlacementGroupInfo,
  PlacementGroupStrategy,
  ProcessorInfo,
  ProductCode,
  StateReason,
  Tag,
  UsageClass,
  VCPUInfo,
  ValidCore,
  ValidThreadsPerCore,
  VirtualizationType,
} from './entity'
import { AwsSecurityGroupModule, } from '../aws_security_group'
import { AwsAccount, } from '../aws_account'
import { AWS, } from '../../services/gateways/aws'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsEc21637666428184, } from './migration/1637666428184-aws_ec2'

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
    amiMapper: (ami: Image) => {
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
        const o2 = new InstanceTypeValue();
        out.instanceType = o2;
        o2.name = instanceType.InstanceType;
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
      out.ami = await AwsEc2Module.mappers.ami.db.read(ctx, instance.ImageId);
      out.instanceType = await AwsEc2Module.mappers.instanceType.db.read(ctx, instance.InstanceType);
      out.securityGroups = await AwsSecurityGroupModule.mappers.securityGroup.db.read(
        ctx,
        [...new Set(instance.SecurityGroups?.map(sg => sg.GroupId).filter(id => !!id)).values()] as string[],
      );
      out.region = await AwsAccount.mappers.region.db.read(
        ctx,
        (await AwsAccount.mappers.awsAccount.db.read(ctx))[0].region.name,
      );
      return out;
    },
  },
  mappers: {
    ami: new Mapper<AMI>({
      entity: AMI,
      entityId: (e: AMI) => e.imageId ?? '',
      // TODO: source: cloud entityPrint not needed (yet)
      entityPrint: (e: AMI) => ({
        id: e.id?.toString() ?? '',
      }),
      equals: (a: AMI, b: AMI) => Object.is(a.imageId, b.imageId),
      source: 'cloud',
      db: new Crud({
        create: async (e: AMI | AMI[], ctx: Context) => {
          const es = Array.isArray(e) ? e : [e];
          // Deduplicate CPUArchitecture and BootMode ahead of time, preserving an ID if it exists
          const cpuArches: { [key: string]: CPUArchitecture, } = {};
          const bootModes: { [key: string]: BootMode, } = {};
          es.forEach((entity: AMI) => {
            if (entity.cpuArchitecture) {
              const arch = entity.cpuArchitecture.cpuArchitecture;
              cpuArches[arch] = cpuArches[arch] ?? entity.cpuArchitecture;
              if (entity.cpuArchitecture.id) cpuArches[arch].id = entity.cpuArchitecture.id;
              entity.cpuArchitecture = cpuArches[arch];
            }
            if (entity.bootMode) {
              const bm = entity.bootMode.mode;
              bootModes[bm] = bootModes[bm] ?? entity.bootMode;
              if (entity.bootMode.id) bootModes[bm].id = entity.bootMode.id;
              entity.bootMode = bootModes[bm];
            }
          });
          // Load the sub-records from the database, if any, to associate the correct IDs
          (await ctx.orm.find(CPUArchitecture)).forEach((a: CPUArchitecture) => {
            cpuArches[a.cpuArchitecture] = cpuArches[a.cpuArchitecture] ?? a;
            cpuArches[a.cpuArchitecture].id = a.id;
          });
          (await ctx.orm.find(BootMode)).forEach((b: BootMode) => {
            bootModes[b.mode] = bootModes[b.mode] ?? b;
            bootModes[b.mode].id = b.id;
          });
          // Pre-save these sub-records first
          await ctx.orm.save(CPUArchitecture, Object.values(cpuArches));
          await ctx.orm.save(BootMode, Object.values(bootModes));
          // Now save the AMI records
          await ctx.orm.save(AMI, es);
        },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const out = await ctx.orm.find(AMI, id ? {
            where: {
              imageId: Array.isArray(id) ? In(id) : id,
            },
          } : undefined);
          if (Array.isArray(id) || Object.is(undefined, id)) {
            return out;
          } else {
            return out[0];
          }
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
                return AwsEc2Module.utils.amiMapper(
                  await client.getAMI(id), ctx
                );
              }));
            } else {
              return AwsEc2Module.utils.amiMapper(
                await client.getAMI(ids), ctx
              );
            }
          } else {
            const amis = (await client.getAMIs())?.Images ?? [];
            return amis.map(AwsEc2Module.utils.amiMapper);
          }
        },
        update: async (_ami: AMI | AMI[], _ctx: Context) => { /* Nope */ },
        delete: async (_ami: AMI | AMI[], _ctx: Context) => { /* Nope */ },
      }),
    }),
    instanceType: new Mapper<InstanceType>({
      entity: InstanceType,
      entityId: (e: InstanceType) => e.instanceType.name,
      // TODO: source: cloud entityPrint not needed (yet)
      entityPrint: (e: InstanceType) => ({
        id: e.id?.toString() ?? '',
      }),
      equals: (a: InstanceType, b: InstanceType) => a.instanceType.name === b.instanceType.name, // TODO
      source: 'cloud',
      db: new Crud({
        create: async (e: InstanceType | InstanceType[], ctx: Context) => {
          const es = Array.isArray(e) ? e : [e];
          // Deduplicate several sub-objects ahead of time, preserving an ID if it exists
          const fpgas: { [key: string]: FPGADeviceInfo, } = {};
          const gpus: { [key: string]: GPUDeviceInfo, } = {};
          const accelerators: { [key: string]: InferenceDeviceInfo, } = {};
          const instanceTypes: { [key: string]: InstanceTypeValue, } = {};
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
            if (entity.instanceType) {
              const name = entity.instanceType.name;
              instanceTypes[name] = instanceTypes[name] ?? entity.instanceType;
              entity.instanceType = instanceTypes[name];
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
          await ctx.orm.save(InstanceTypeValue, Object.values(instanceTypes));
          await ctx.orm.save(PlacementGroupStrategy, Object.values(strategies));
          await ctx.orm.save(CPUArchitecture, Object.values(cpuArches));
          await ctx.orm.save(BootMode, Object.values(bootModes));
          await ctx.orm.save(DeviceType, Object.values(rootTypeDevices));
          await ctx.orm.save(UsageClass, Object.values(usageClasses));
          await ctx.orm.save(VirtualizationType, Object.values(virtualizationTypes));
          // Now save the InstanceType records
          await ctx.orm.save(InstanceType, es);
        },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          // TypeORM where clause not working correctly, again
          const ids = Array.isArray(id) ? id : [id].filter(i => !!i);
          const allInstances = await ctx.orm.find(InstanceType);
          const out = allInstances.filter((i: InstanceType) => ids.includes(i.instanceType.name));
          return Array.isArray(id) || id === undefined ? out : out[0];
        },
        update: async (e: InstanceType | InstanceType[], ctx: Context) => { await ctx.orm.save(InstanceType, e); },
        delete: async (e: InstanceType | InstanceType[], ctx: Context) => { await ctx.orm.remove(InstanceType, e); },
      }),
      cloud: new Crud({
        create: async (_i: InstanceType | InstanceType[], _ctx: Context) => { /* Do nothing, not allowed */ },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            if (Array.isArray(ids)) {
              return await Promise.all(ids.map(async (id) => {
                return AwsEc2Module.utils.instanceTypeMapper(await client.getInstanceType(id));
              }));
            } else {
              return AwsEc2Module.utils.instanceTypeMapper(await client.getInstanceType(ids));
            }
          } else {
            const instanceTypes = (await client.getInstanceTypes())?.InstanceTypes ?? [];
            return instanceTypes.map(AwsEc2Module.utils.instanceTypeMapper);
          }
        },
        update: async (_i: InstanceType | InstanceType[], _ctx: Context) => { /* Nope */ },
        delete: async (_i: InstanceType | InstanceType[], _ctx: Context) => { /* Nope */ },
      }),
    }),
    instance: new Mapper<Instance>({
      entity: Instance,
      entityId: (i: Instance) => i.instanceId ?? '',
      entityPrint: (e: Instance) => ({
        id: e.id?.toString() ?? '',
        instanceId: e.instanceId ?? '',
        ami: e.ami?.imageId ?? '',
        region: e.region?.name ?? '',
        instanceType: e.instanceType?.instanceType?.name ?? '',
        securityGroups: e.securityGroups?.map(sg => sg.groupName ?? '').join(', '),
      }),
      equals: (a: Instance, b: Instance) => Object.is(a.instanceId, b.instanceId) &&
        AwsEc2Module.mappers.ami.equals(a.ami, b.ami) &&
        Object.is(a.region.name, b.region.name) &&
        Object.is(a.instanceType.instanceType.name, b.instanceType.instanceType.name) &&
        a.securityGroups.length === b.securityGroups.length, // TODO: Better security group testing
      source: 'db',
      db: new Crud({
        create: async (e: Instance | Instance[], ctx: Context) => { await ctx.orm.save(Instance, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const out = await ctx.orm.find(Instance, id ? {
            where: {
              instanceId: Array.isArray(id) ? In(id) : id,
            },
          } : undefined);
          if (Array.isArray(id) || Object.is(undefined, id)) {
            return out;
          } else {
            return out[0];
          }
        },
        update: async (e: Instance | Instance[], ctx: Context) => { await ctx.orm.save(Instance, e); },
        delete: async (e: Instance | Instance[], ctx: Context) => { await ctx.orm.remove(Instance, e); },
      }),
      cloud: new Crud({
        create: async (e: Instance | Instance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(e) ? e : [e];
          for (const instance of es) {
            if (instance.ami.imageId) {
              const instanceId = await client.newInstance(
                instance.instanceType.instanceType.name,
                instance.ami.imageId,
                [...new Set(instance.securityGroups.map(sg => sg.groupId).filter(id => !!id)).values()] as string[],
              );
              if (!instanceId) { // then who?
                throw new Error('should not be possible');
              }
              instance.instanceId = instanceId;
              await AwsEc2Module.mappers.instance.db.update(instance, ctx);
            }
          }
        },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids && !Array.isArray(ids)) {
            const i = await client.getInstance(ids);
            return await AwsEc2Module.utils.instanceMapper(i, ctx);
          }
          const is = (await client.getInstances())?.Instances ?? [];
          const out = await Promise.all(is
            .filter(i => !Array.isArray(ids) || ids.includes(i?.InstanceId ?? 'what'))
            .filter((i: InstanceAWS) => (i?.State?.Code ?? 9001) < 32)
            .map(i => AwsEc2Module.utils.instanceMapper(i, ctx)));
          return out;
        },
        update: async (e: Instance | Instance[], ctx: Context) => {
          // The second pass should remove the old instances
          await AwsEc2Module.mappers.instance.cloud.create(e, ctx);
        },
        delete: async (e: Instance | Instance[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(e) ? e : [e];
          for (const entity of es) {
            if (entity.instanceId) await client.terminateInstance(entity.instanceId);
          }
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsEc21637666428184.prototype.up,
    preremove: awsEc21637666428184.prototype.down,
  },
});