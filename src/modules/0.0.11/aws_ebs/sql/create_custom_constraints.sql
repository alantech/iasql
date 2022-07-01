-- Create EC2 instance and EBS volume must be in the same availability zone
create or replace function check_instance_ebs_availability_zone(_instance_id integer, _ebs_availability_zone general_purpose_volume_availability_zone_enum) returns boolean
language plpgsql security definer
as $$
declare
  _instance_availability_zone subnet_availability_zone_enum;
begin
  select subnet.availability_zone into _instance_availability_zone
  from instance
  inner join subnet on subnet.id = instance.subnet_id
  where instance.id = _instance_id;
  return _instance_availability_zone::text = _ebs_availability_zone::text;
end;
$$;
ALTER TABLE general_purpose_volume ADD CONSTRAINT check_instance_ebs_availability_zone CHECK (check_instance_ebs_availability_zone(attached_instance_id, availability_zone));
