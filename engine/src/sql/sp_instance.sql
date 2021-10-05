create or replace function create_instance(
  amiid text,
  instancetype text,
  securitygroupname text
)
returns integer as $$ 
declare
  ami_id integer;
  instance_type_id integer;
  instance_id integer;
  sg record;
begin
  select id into ami_id
  from ami
  where image_id like amiid
  order by creation_date desc
  limit 1;

  select id into instance_type_id
  from instance_type
  where instance_type_value_id in (
      select id
      from instance_type_value
      where name like instancetype
    );

  insert into
    instance (ami_id, instance_type_id)
  values
    (ami_id, instance_type_id);

  select id into instance_id
  from instance
  order by id desc
  limit 1;

  for sg in
    select id
    from security_group
    where group_name like securitygroupname
  loop
    insert into
      instance_security_groups_security_group (instance_id, security_group_id)
    values
      (instance_id, sg.id);
  end loop;

  return instance_id;

end;
$$ language plpgsql;

select * from create_instance('ami-0d1bf5b68307103c2', 't2.micro', 'default');

select * from instance;

select * from instance_security_groups_security_group isgsg;