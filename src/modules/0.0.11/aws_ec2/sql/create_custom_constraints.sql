-- Create target group instance constraint
create or replace function check_target_group_instance(_target_group_name text) returns boolean
language plpgsql security definer
as $$
declare
  _target_group_type target_group_target_type_enum;
begin
  select target_type into _target_group_type
  from target_group
  where target_group_name = _target_group_name;
  return _target_group_type = 'instance';
end;
$$;
ALTER TABLE registered_instance ADD CONSTRAINT check_target_group_instance CHECK (check_target_group_instance(target_group));

-- Create role ec2 instance profile constraint
CREATE INDEX role_policy_document_gin_idx ON role USING gin ((assume_role_policy_document -> 'Statement') jsonb_path_ops);
create or replace function check_role_ec2(_role_name text) returns boolean
language plpgsql security definer
as $$
declare
  _number_of_records integer;
begin
  select count(*) into _number_of_records
  from role
  where role_name = _role_name AND assume_role_policy_document -> 'Statement' @> '[{"Effect": "Allow", "Principal": { "Service": "ec2.amazonaws.com" }}]';
  return _number_of_records > 0;
end;
$$;
ALTER TABLE instance ADD CONSTRAINT check_role_ec2 CHECK (check_role_ec2(role_name));
