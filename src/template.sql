create table region (
  region_id int generated always as identity,
  region_name varchar(30),
  endpoint varchar(60),
  opt_in_status varchar(20),
  primary key(region_id)
);

create type availability_zone_state as enum ('available', 'impaired', 'information', 'unavailable');
create type availability_zone_opt_in_status as enum ('not-opted-in', 'opt-in-not-required', 'opted-in');

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

-- TODO: complete schema
create table instance_type (
  instance_type_id int generated always as identity,
  instance_type varchar(50),
  current_generation boolean,
  free_tier_eligible boolean,
  bare_metal boolean,
  hypervisor varchar(50),
  instance_storage_supported boolean,
  hibernation_supported boolean,
  burstable_performance_supported boolean,
  dedicated_hosts_supported boolean,
  auto_recovery_supported boolean,
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

create type architecture_values as enum ('arm64', 'i386', 'x86_64');

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

create type device_type as enum ('ebs', 'instance-store');

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

create type virtualization_type_values as enum ('hvm', 'paravirtual');

create type boot_mode_values as enum ('legacy-bios', 'uefi');

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