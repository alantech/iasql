create table region (
  region_id int generated always as identity,
  region_name varchar(30),
  endpoint varchar(60),
  opt_in_status varchar(20),
  primary key(region_id)
);

create type availability_zone_state as enum (
  'available',
  'impaired',
  'information',
  'unavailable'
);

create type availability_zone_opt_in_status as enum (
  'not-opted-in',
  'opt-in-not-required',
  'opted-in'
);

create table availability_zone (
  availability_zone_id int generated always as identity,
  state availability_zone_state,
  opt_in_status availability_zone_opt_in_status,
  messages varchar(100) array,
  region_id int,
  zone_name varchar(30),
  zone_id varchar(30),
  group_name varchar(30),
  network_border_group varchar(30),
  zone_type varchar(30),
  parent_zone_id int null,
  primary key(availability_zone_id),
  constraint fk_region foreign key(region_id) references region(region_id)
);

create type instance_type_values as enum (
  'a1.2xlarge',
  'a1.4xlarge',
  'a1.large',
  'a1.medium',
  'a1.metal',
  'a1.xlarge',
  'c1.medium',
  'c1.xlarge',
  'c3.2xlarge',
  'c3.4xlarge',
  'c3.8xlarge',
  'c3.large',
  'c3.xlarge',
  'c4.2xlarge',
  'c4.4xlarge',
  'c4.8xlarge',
  'c4.large',
  'c4.xlarge',
  'c5.12xlarge',
  'c5.18xlarge',
  'c5.24xlarge',
  'c5.2xlarge',
  'c5.4xlarge',
  'c5.9xlarge',
  'c5.large',
  'c5.metal',
  'c5.xlarge',
  'c5a.12xlarge',
  'c5a.16xlarge',
  'c5a.24xlarge',
  'c5a.2xlarge',
  'c5a.4xlarge',
  'c5a.8xlarge',
  'c5a.large',
  'c5a.xlarge',
  'c5ad.12xlarge',
  'c5ad.16xlarge',
  'c5ad.24xlarge',
  'c5ad.2xlarge',
  'c5ad.4xlarge',
  'c5ad.8xlarge',
  'c5ad.large',
  'c5ad.xlarge',
  'c5d.12xlarge',
  'c5d.18xlarge',
  'c5d.24xlarge',
  'c5d.2xlarge',
  'c5d.4xlarge',
  'c5d.9xlarge',
  'c5d.large',
  'c5d.metal',
  'c5d.xlarge',
  'c5n.18xlarge',
  'c5n.2xlarge',
  'c5n.4xlarge',
  'c5n.9xlarge',
  'c5n.large',
  'c5n.metal',
  'c5n.xlarge',
  'c6g.12xlarge',
  'c6g.16xlarge',
  'c6g.2xlarge',
  'c6g.4xlarge',
  'c6g.8xlarge',
  'c6g.large',
  'c6g.medium',
  'c6g.metal',
  'c6g.xlarge',
  'c6gd.12xlarge',
  'c6gd.16xlarge',
  'c6gd.2xlarge',
  'c6gd.4xlarge',
  'c6gd.8xlarge',
  'c6gd.large',
  'c6gd.medium',
  'c6gd.metal',
  'c6gd.xlarge',
  'c6gn.12xlarge',
  'c6gn.16xlarge',
  'c6gn.2xlarge',
  'c6gn.4xlarge',
  'c6gn.8xlarge',
  'c6gn.large',
  'c6gn.medium',
  'c6gn.xlarge',
  'cc1.4xlarge',
  'cc2.8xlarge',
  'cg1.4xlarge',
  'cr1.8xlarge',
  'd2.2xlarge',
  'd2.4xlarge',
  'd2.8xlarge',
  'd2.xlarge',
  'd3.2xlarge',
  'd3.4xlarge',
  'd3.8xlarge',
  'd3.xlarge',
  'd3en.12xlarge',
  'd3en.2xlarge',
  'd3en.4xlarge',
  'd3en.6xlarge',
  'd3en.8xlarge',
  'd3en.xlarge',
  'f1.16xlarge',
  'f1.2xlarge',
  'f1.4xlarge',
  'g2.2xlarge',
  'g2.8xlarge',
  'g3.16xlarge',
  'g3.4xlarge',
  'g3.8xlarge',
  'g3s.xlarge',
  'g4ad.16xlarge',
  'g4ad.2xlarge',
  'g4ad.4xlarge',
  'g4ad.8xlarge',
  'g4ad.xlarge',
  'g4dn.12xlarge',
  'g4dn.16xlarge',
  'g4dn.2xlarge',
  'g4dn.4xlarge',
  'g4dn.8xlarge',
  'g4dn.metal',
  'g4dn.xlarge',
  'h1.16xlarge',
  'h1.2xlarge',
  'h1.4xlarge',
  'h1.8xlarge',
  'hi1.4xlarge',
  'hs1.8xlarge',
  'i2.2xlarge',
  'i2.4xlarge',
  'i2.8xlarge',
  'i2.xlarge',
  'i3.16xlarge',
  'i3.2xlarge',
  'i3.4xlarge',
  'i3.8xlarge',
  'i3.large',
  'i3.metal',
  'i3.xlarge',
  'i3en.12xlarge',
  'i3en.24xlarge',
  'i3en.2xlarge',
  'i3en.3xlarge',
  'i3en.6xlarge',
  'i3en.large',
  'i3en.metal',
  'i3en.xlarge',
  'inf1.24xlarge',
  'inf1.2xlarge',
  'inf1.6xlarge',
  'inf1.xlarge',
  'm1.large',
  'm1.medium',
  'm1.small',
  'm1.xlarge',
  'm2.2xlarge',
  'm2.4xlarge',
  'm2.xlarge',
  'm3.2xlarge',
  'm3.large',
  'm3.medium',
  'm3.xlarge',
  'm4.10xlarge',
  'm4.16xlarge',
  'm4.2xlarge',
  'm4.4xlarge',
  'm4.large',
  'm4.xlarge',
  'm5.12xlarge',
  'm5.16xlarge',
  'm5.24xlarge',
  'm5.2xlarge',
  'm5.4xlarge',
  'm5.8xlarge',
  'm5.large',
  'm5.metal',
  'm5.xlarge',
  'm5a.12xlarge',
  'm5a.16xlarge',
  'm5a.24xlarge',
  'm5a.2xlarge',
  'm5a.4xlarge',
  'm5a.8xlarge',
  'm5a.large',
  'm5a.xlarge',
  'm5ad.12xlarge',
  'm5ad.16xlarge',
  'm5ad.24xlarge',
  'm5ad.2xlarge',
  'm5ad.4xlarge',
  'm5ad.8xlarge',
  'm5ad.large',
  'm5ad.xlarge',
  'm5d.12xlarge',
  'm5d.16xlarge',
  'm5d.24xlarge',
  'm5d.2xlarge',
  'm5d.4xlarge',
  'm5d.8xlarge',
  'm5d.large',
  'm5d.metal',
  'm5d.xlarge',
  'm5dn.12xlarge',
  'm5dn.16xlarge',
  'm5dn.24xlarge',
  'm5dn.2xlarge',
  'm5dn.4xlarge',
  'm5dn.8xlarge',
  'm5dn.large',
  'm5dn.metal',
  'm5dn.xlarge',
  'm5n.12xlarge',
  'm5n.16xlarge',
  'm5n.24xlarge',
  'm5n.2xlarge',
  'm5n.4xlarge',
  'm5n.8xlarge',
  'm5n.large',
  'm5n.metal',
  'm5n.xlarge',
  'm5zn.12xlarge',
  'm5zn.2xlarge',
  'm5zn.3xlarge',
  'm5zn.6xlarge',
  'm5zn.large',
  'm5zn.metal',
  'm5zn.xlarge',
  'm6g.12xlarge',
  'm6g.16xlarge',
  'm6g.2xlarge',
  'm6g.4xlarge',
  'm6g.8xlarge',
  'm6g.large',
  'm6g.medium',
  'm6g.metal',
  'm6g.xlarge',
  'm6gd.12xlarge',
  'm6gd.16xlarge',
  'm6gd.2xlarge',
  'm6gd.4xlarge',
  'm6gd.8xlarge',
  'm6gd.large',
  'm6gd.medium',
  'm6gd.metal',
  'm6gd.xlarge',
  'm6i.12xlarge',
  'm6i.16xlarge',
  'm6i.24xlarge',
  'm6i.2xlarge',
  'm6i.32xlarge',
  'm6i.4xlarge',
  'm6i.8xlarge',
  'm6i.large',
  'm6i.xlarge',
  'mac1.metal',
  'p2.16xlarge',
  'p2.8xlarge',
  'p2.xlarge',
  'p3.16xlarge',
  'p3.2xlarge',
  'p3.8xlarge',
  'p3dn.24xlarge',
  'p4d.24xlarge',
  'r3.2xlarge',
  'r3.4xlarge',
  'r3.8xlarge',
  'r3.large',
  'r3.xlarge',
  'r4.16xlarge',
  'r4.2xlarge',
  'r4.4xlarge',
  'r4.8xlarge',
  'r4.large',
  'r4.xlarge',
  'r5.12xlarge',
  'r5.16xlarge',
  'r5.24xlarge',
  'r5.2xlarge',
  'r5.4xlarge',
  'r5.8xlarge',
  'r5.large',
  'r5.metal',
  'r5.xlarge',
  'r5a.12xlarge',
  'r5a.16xlarge',
  'r5a.24xlarge',
  'r5a.2xlarge',
  'r5a.4xlarge',
  'r5a.8xlarge',
  'r5a.large',
  'r5a.xlarge',
  'r5ad.12xlarge',
  'r5ad.16xlarge',
  'r5ad.24xlarge',
  'r5ad.2xlarge',
  'r5ad.4xlarge',
  'r5ad.8xlarge',
  'r5ad.large',
  'r5ad.xlarge',
  'r5b.12xlarge',
  'r5b.16xlarge',
  'r5b.24xlarge',
  'r5b.2xlarge',
  'r5b.4xlarge',
  'r5b.8xlarge',
  'r5b.large',
  'r5b.metal',
  'r5b.xlarge',
  'r5d.12xlarge',
  'r5d.16xlarge',
  'r5d.24xlarge',
  'r5d.2xlarge',
  'r5d.4xlarge',
  'r5d.8xlarge',
  'r5d.large',
  'r5d.metal',
  'r5d.xlarge',
  'r5dn.12xlarge',
  'r5dn.16xlarge',
  'r5dn.24xlarge',
  'r5dn.2xlarge',
  'r5dn.4xlarge',
  'r5dn.8xlarge',
  'r5dn.large',
  'r5dn.metal',
  'r5dn.xlarge',
  'r5n.12xlarge',
  'r5n.16xlarge',
  'r5n.24xlarge',
  'r5n.2xlarge',
  'r5n.4xlarge',
  'r5n.8xlarge',
  'r5n.large',
  'r5n.metal',
  'r5n.xlarge',
  'r6g.12xlarge',
  'r6g.16xlarge',
  'r6g.2xlarge',
  'r6g.4xlarge',
  'r6g.8xlarge',
  'r6g.large',
  'r6g.medium',
  'r6g.metal',
  'r6g.xlarge',
  'r6gd.12xlarge',
  'r6gd.16xlarge',
  'r6gd.2xlarge',
  'r6gd.4xlarge',
  'r6gd.8xlarge',
  'r6gd.large',
  'r6gd.medium',
  'r6gd.metal',
  'r6gd.xlarge',
  't1.micro',
  't2.2xlarge',
  't2.large',
  't2.medium',
  't2.micro',
  't2.nano',
  't2.small',
  't2.xlarge',
  't3.2xlarge',
  't3.large',
  't3.medium',
  't3.micro',
  't3.nano',
  't3.small',
  't3.xlarge',
  't3a.2xlarge',
  't3a.large',
  't3a.medium',
  't3a.micro',
  't3a.nano',
  't3a.small',
  't3a.xlarge',
  't4g.2xlarge',
  't4g.large',
  't4g.medium',
  't4g.micro',
  't4g.nano',
  't4g.small',
  't4g.xlarge',
  'u-12tb1.112xlarge',
  'u-12tb1.metal',
  'u-18tb1.metal',
  'u-24tb1.metal',
  'u-6tb1.112xlarge',
  'u-6tb1.56xlarge',
  'u-6tb1.metal',
  'u-9tb1.112xlarge',
  'u-9tb1.metal',
  'x1.16xlarge',
  'x1.32xlarge',
  'x1e.16xlarge',
  'x1e.2xlarge',
  'x1e.32xlarge',
  'x1e.4xlarge',
  'x1e.8xlarge',
  'x1e.xlarge',
  'x2gd.12xlarge',
  'x2gd.16xlarge',
  'x2gd.2xlarge',
  'x2gd.4xlarge',
  'x2gd.8xlarge',
  'x2gd.large',
  'x2gd.medium',
  'x2gd.metal',
  'x2gd.xlarge',
  'z1d.12xlarge',
  'z1d.2xlarge',
  'z1d.3xlarge',
  'z1d.6xlarge',
  'z1d.large',
  'z1d.metal',
  'z1d.xlarge'
);

create type usage_class_type as enum ('on-demand', 'spot');

create type device_type as enum ('ebs', 'instance-store');

create type virtualization_type_values as enum ('hvm', 'paravirtual');

create type instance_type_hypervisor as enum ('nitro', 'xen');

create type architecture_values as enum ('arm64', 'i386', 'x86_64');

create type processor_info_type as (
  supported_architectures architecture_values array,
  sustained_clock_speed_in_ghz decimal
);

create type v_cpu_info_type as (
  default_v_cpus decimal,
  default_cores decimal,
  default_threads_per_core decimal,
  valid_cores decimal array,
  valid_threads_per_core decimal array
);

create type memory_info_type as (size_in_MiB decimal);

create type disk_type as enum ('hdd', 'ssd');

create type disk_info as (
  size_in_GB decimal,
  count int,
  type disk_type
);

create type ephemeral_nvme_support as enum ('required', 'supported', 'unsupported');

create type instance_storage_info_type as (
  total_size_in_GB decimal,
  disks disk_info array,
  nvme_support ephemeral_nvme_support
);

create type ebs_optimized_support_values as enum ('default', 'supported', 'unsupported');

create type ebs_encryption_support as enum ('supported', 'unsupported');

create type ebs_optimized_info_type as (
  baseline_bandwidth_in_Mbps decimal,
  baseline_throughput_in_MBps decimal,
  baseline_iops decimal,
  maximum_bandwidth_in_Mbps decimal,
  maximum_throughput_in_MBps decimal,
  maximum_iops decimal
);

create type ebs_info_type as (
  ebs_optimized_support ebs_optimized_support_values,
  encryption_support ebs_encryption_support,
  ebs_optimized_info ebs_optimized_info_type,
  nvme_support ephemeral_nvme_support
);

create type network_card_info as (
  network_card_index int,
  network_performance varchar(100),
  maximum_network_interfaces int
);

create type ena_support_values as enum ('required', 'supported', 'unsupported');

create type efa_info_type as (maximum_efa_interfaces int);

create type network_info_type as (
  network_performance varchar(100),
  maximum_network_interfaces int,
  maximum_network_cards int,
  default_network_card_index int,
  network_cards network_card_info array,
  ipv4_addresses_per_interface int,
  ipv6_addresses_per_interface int,
  ipv6_supported boolean,
  ena_support ena_support_values,
  efa_supported boolean,
  efa_info efa_info_type,
  encryption_in_transit_supported boolean
);

create type gpu_device_memory_info as (size_in_MiB decimal);

create type gpu_devide_info_type as (
  name varchar(50),
  manufacturer varchar(100),
  count int,
  memory_info gpu_device_memory_info
);

create type gpu_info_type as (
  gpus gpu_devide_info_type array,
  total_gpu_memory_in_MiB decimal
);

create type fpga_device_memory_info as (size_in_MiB decimal);

create type fpga_device_info as (
  name varchar(50),
  manufacturer varchar(100),
  count int,
  memory_info fpga_device_memory_info
);

create type fpga_info_type as (
  fpgas fpga_device_info array,
  total_fpga_memory_in_MiB decimal
);

create type placement_group_strategy as enum ('cluster', 'partition', 'spread');

create type placement_group_info_type as (
  supported_strategies placement_group_strategy array
);

create type inference_device_info as (
  count int,
  name varchar(50),
  manufacturer varchar(100)
);

create type inference_accelerator_info_type as (accelerators inference_device_info array);

create type boot_mode_values as enum ('legacy-bios', 'uefi');

create table instance_type (
  instance_type_id int generated always as identity,
  instance_type instance_type_values,
  current_generation boolean,
  free_tier_eligible boolean,
  supported_usage_classes usage_class_type array,
  supported_root_device_types device_type array,
  supported_virtualization_types virtualization_type_values array,
  bare_metal boolean,
  hypervisor instance_type_hypervisor,
  processor_info processor_info_type,
  v_cpu_info v_cpu_info_type,
  memory_info memory_info_type,
  instance_storage_supported boolean,
  instance_storage_info instance_storage_info_type,
  ebs_info ebs_info_type,
  network_info network_info_type,
  gpu_info gpu_info_type,
  fpga_info fpga_info_type,
  placement_group_info placement_group_info_type,
  inference_accelerator_info inference_accelerator_info_type,
  hibernation_supported boolean,
  burstable_performance_supported boolean,
  dedicated_hosts_supported boolean,
  auto_recovery_supported boolean,
  supported_boot_modes boot_mode_values,
  primary key(instance_type_id)
);

create table instance_type_by_region (
  instance_type_by_region_id int generated always as identity,
  instance_type_id int not null,
  region_id int not null,
  primary key(instance_type_by_region_id),
  constraint fk_region foreign key(region_id) references region(region_id),
  constraint fk_instance_type foreign key(instance_type_id) references instance_type(instance_type_id)
);

create table instance_type_by_availability_zone (
  instance_type_by_availability_zone_id int generated always as identity,
  instance_type_id int not null,
  availability_zone_id int not null,
  primary key(instance_type_by_availability_zone_id),
  constraint fk_availability_zone foreign key(availability_zone_id) references availability_zone(availability_zone_id),
  constraint fk_instance_type foreign key(instance_type_id) references instance_type(instance_type_id)
);

create type image_type_values as enum ('kernel', 'machine', 'ramdisk');

create type ami_platform_values as enum ('windows', '');

create type product_code_values as enum ('devpay', 'marketplace');

create type product_code as (
  product_code_id varchar(50),
  product_code_type product_code_values
);

create type image_state as enum (
  'available',
  'deregistered',
  'error',
  'failed',
  'invalid',
  'pending',
  'transient'
);

create type hypervisor_type as enum ('ovm', 'xen');

create type ebs_block_device_volume_type as enum (
  'gp2',
  'gp3',
  'io1',
  'io2',
  'sc1',
  'st1',
  'standard'
);

create type ebs_block_device_type as (
  delete_on_termination boolean,
  iops int,
  snapshot_id varchar(50),
  volume_size int,
  volume_type ebs_block_device_volume_type,
  kms_key_id varchar(50),
  throughput int,
  outpost_arn varchar(100),
  encrypted boolean
);

create type block_device_mapping as (
  device_name varchar(50),
  virtual_name varchar(50),
  ebs ebs_block_device_type,
  no_device varchar(50)
);

-- create type throughput_range as range (int4range(125, 1000));
create type state_reason_type as (code varchar(50), message varchar(1000));

create type tag as (key varchar(50), value varchar(500));

create table ami (
  ami_id int generated always as identity,
  architecture architecture_values,
  creation_date timestamp,
  image_id varchar(50),
  image_location varchar(300),
  image_type image_type_values,
  public boolean,
  kernel_id varchar(50),
  owner_id varchar(20),
  platform ami_platform_values,
  platform_details varchar(50),
  usage_operation varchar(50),
  product_codes product_code array,
  ramdisk_id varchar(50),
  state image_state,
  block_device_mappings block_device_mapping array,
  description varchar(500),
  ena_support boolean,
  hypervisor hypervisor_type,
  image_owner_alias varchar(50),
  name varchar(300),
  root_device_name varchar(50),
  root_device_type device_type,
  sriov_net_support varchar(50),
  state_reason state_reason_type,
  tags tag array,
  virtualization_type virtualization_type_values,
  boot_mode boot_mode_values,
  deprecation_time timestamp,
  primary key(ami_id)
);

create table security_groups (
  id int generated always as identity,
  description text,
  group_name text,
  owner_id varchar(50),
  group_id varchar(50),
  vpc_id varchar(50),
  primary key(id)
);

create table security_group_rules (
  id int generated always as identity,
  security_group_rule_id varchar(50),
  group_id varchar(50), -- This is the string ID from AWS
  security_group_id int, -- And this is the internal integer ID, this one is faster to join on and we can't join on the nullable string when it's still null
  group_owner_id varchar(50),
  is_egress boolean,
  ip_protocol varchar(50),
  from_port int,
  to_port int,
  cidr_ipv4 cidr, -- TODO: Replace with string and constraint
  cidr_ipv6 cidr, -- TODO: Same
  prefix_list_id varchar(50),
  description text,
  -- TODO: Do I include the "ReferencedGroupInfo" that appears to be metadata on the `group_id` record but also has some fields that *aren't* in the security_group table for some godforsaken reason?
  primary key(id),
  constraint fk_security_group foreign key(security_group_id) references security_groups(id)
);