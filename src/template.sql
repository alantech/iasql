create table region (
  region_id int generated always as identity,
  region_name varchar(30),
  endpoint varchar(60),
  opt_in_status varchar(20),
  primary key(region_id)
);

-- TODO: complete schema
create table availability_zone (
  availability_zone_id int generated always as identity,
  state varchar(50),
  opt_in_status varchar(20),
  region_id int,
  zone_name varchar(30),
  zone_id varchar(30),
  group_name varchar(30),
  network_border_group varchar(30),
  zone_type varchar(30),
  parent_zone_id int null,
  primary key(availability_zone_id),
  constraint fk_region
    foreign key(region_id) 
  references region(region_id)
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
  instance_type_id int,
  region_id int,
  primary key(instance_type_by_region_id),
  constraint fk_region
    foreign key(region_id) 
  references region(region_id),
  constraint fk_instance_type
    foreign key(instance_type_id) 
  references instance_type(instance_type_id)
);

create table instance_type_by_availability_zone (
  instance_type_by_availability_zone_id int generated always as identity,
  instance_type_id int,
  availability_zone_id int,
  primary key(instance_type_by_availability_zone_id),
  constraint fk_availability_zone
    foreign key(availability_zone_id) 
  references availability_zone(availability_zone_id),
  constraint fk_instance_type
    foreign key(instance_type_id) 
  references instance_type(instance_type_id)
);

-- TODO: complete schema
create table ami (
  ami_id int generated always as identity,
  architecture varchar(10),
  creation_date timestamp,
  image_id varchar(50),
  image_location varchar(300),
  image_type varchar(20),
  public boolean,
  owner_id varchar(20),
  platform_details varchar(50),
  usage_operation varchar(50),
  state varchar(50),
  hypervisor varchar(50),
  name varchar(300),
  root_device_type varchar(50),
  virtualization_type varchar(50),
  primary key(ami_id)
);