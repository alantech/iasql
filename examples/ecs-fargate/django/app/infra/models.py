# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.contrib.postgres.fields import ArrayField
from django.db import models


class AvailabilityZone(models.Model):
    name = models.TextField(primary_key=True)

    class Meta:
        managed = False
        db_table = 'availability_zone'


class AwsCredentials(models.Model):
    access_key_id = models.TextField()
    secret_access_key = models.TextField()

    class Meta:
        managed = False
        db_table = 'aws_credentials'


class AwsRegions(models.Model):
    region = models.TextField(primary_key=True)
    is_default = models.BooleanField()
    is_enabled = models.BooleanField()

    class Meta:
        managed = False
        db_table = 'aws_regions'


class Certificate(models.Model):
    arn = models.TextField(unique=True, blank=True, null=True)
    certificate_id = models.TextField(blank=True, null=True)
    domain_name = models.TextField()
    certificate_type = models.TextField(blank=True, null=True)  # This field type is a guess.
    status = models.TextField(blank=True, null=True)  # This field type is a guess.
    renewal_eligibility = models.TextField(blank=True, null=True)  # This field type is a guess.
    in_use = models.BooleanField()

    class Meta:
        managed = False
        db_table = 'certificate'


class Cluster(models.Model):
    cluster_name = models.TextField(primary_key=True)
    cluster_arn = models.TextField(blank=True, null=True)
    cluster_status = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'cluster'


class ContainerDefinition(models.Model):
    name = models.TextField()
    image = models.TextField(blank=True, null=True)
    tag = models.TextField(blank=True, null=True)
    digest = models.TextField(blank=True, null=True)
    essential = models.BooleanField()
    cpu = models.IntegerField(blank=True, null=True)
    memory = models.IntegerField(blank=True, null=True)
    memory_reservation = models.IntegerField(blank=True, null=True)
    host_port = models.IntegerField(blank=True, null=True)
    container_port = models.IntegerField(blank=True, null=True)
    protocol = models.TextField(blank=True, null=True)  # This field type is a guess.
    env_variables = models.TextField(blank=True, null=True)
    task_definition = models.ForeignKey('TaskDefinition', models.DO_NOTHING, blank=True, null=True)
    repository_name = models.ForeignKey('Repository', models.DO_NOTHING, db_column='repository_name', blank=True,
                                        null=True)
    public_repository_name = models.ForeignKey('PublicRepository', models.DO_NOTHING,
                                               db_column='public_repository_name', blank=True, null=True)
    log_group = models.ForeignKey('LogGroup', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'container_definition'


class EcsSimplified(models.Model):
    app_name = models.TextField(primary_key=True, max_length=18)
    desired_count = models.IntegerField()
    app_port = models.IntegerField()
    cpu_mem = models.TextField()  # This field type is a guess.
    repository_uri = models.TextField(blank=True, null=True)
    image_tag = models.TextField(blank=True, null=True)
    image_digest = models.TextField(blank=True, null=True)
    public_ip = models.BooleanField()
    load_balancer_dns = models.TextField(blank=True, null=True)
    env_variables = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'ecs_simplified'


class ElasticIp(models.Model):
    allocation_id = models.TextField(blank=True, null=True)
    public_ip = models.TextField(unique=True, blank=True, null=True)
    tags = models.TextField(blank=True, null=True)  # This field type is a guess.

    class Meta:
        managed = False
        db_table = 'elastic_ip'


class EndpointGateway(models.Model):
    vpc_endpoint_id = models.TextField(blank=True, null=True)
    service = models.TextField()  # This field type is a guess.
    policy_document = models.TextField(blank=True, null=True)
    state = models.TextField(blank=True, null=True)
    route_table_ids = models.TextField(blank=True, null=True)  # This field type is a guess.
    tags = models.TextField(blank=True, null=True)  # This field type is a guess.
    vpc = models.ForeignKey('Vpc', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'endpoint_gateway'


class IasqlAuditLog(models.Model):
    ts = models.DateTimeField()
    user = models.TextField()
    table_name = models.TextField()
    change_type = models.TextField()  # This field type is a guess.
    change = models.TextField()  # This field type is a guess.

    class Meta:
        managed = False
        db_table = 'iasql_audit_log'


class IasqlDependencies(models.Model):
    module = models.OneToOneField('IasqlModule', models.DO_NOTHING, db_column='module', primary_key=True)
    dependency = models.ForeignKey('IasqlModule', models.DO_NOTHING, db_column='dependency', related_name='module')

    class Meta:
        managed = False
        db_table = 'iasql_dependencies'
        unique_together = (('module', 'dependency'),)


class IasqlModule(models.Model):
    name = models.TextField(primary_key=True)

    class Meta:
        managed = False
        db_table = 'iasql_module'


class IasqlOperation(models.Model):
    opid = models.UUIDField(primary_key=True)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(blank=True, null=True)
    optype = models.TextField()  # This field type is a guess.
    params = models.TextField()  # This field type is a guess.
    output = models.TextField(blank=True, null=True)
    err = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'iasql_operation'


class IasqlRpc(models.Model):
    opid = models.UUIDField(primary_key=True)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(blank=True, null=True)
    module_name = models.TextField()
    method_name = models.TextField()
    params = models.TextField()  # This field type is a guess.
    output = models.TextField(blank=True, null=True)
    err = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'iasql_rpc'


class IasqlTables(models.Model):
    table = models.TextField(primary_key=True)
    module = models.ForeignKey(IasqlModule, models.DO_NOTHING, db_column='module')

    class Meta:
        managed = False
        db_table = 'iasql_tables'
        unique_together = (('table', 'module'),)


class Listener(models.Model):
    listener_arn = models.TextField(blank=True, null=True)
    port = models.IntegerField()
    protocol = models.TextField()  # This field type is a guess.
    action_type = models.TextField()  # This field type is a guess.
    ssl_policy = models.TextField(blank=True, null=True)
    load_balancer_name = models.ForeignKey('LoadBalancer', models.DO_NOTHING, db_column='load_balancer_name')
    target_group_name = models.ForeignKey('TargetGroup', models.DO_NOTHING, db_column='target_group_name')
    certificate = models.ForeignKey(Certificate, models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'listener'
        unique_together = (('load_balancer_name', 'port'),)


class LoadBalancer(models.Model):
    load_balancer_name = models.TextField(primary_key=True)
    load_balancer_arn = models.TextField(blank=True, null=True)
    dns_name = models.TextField(blank=True, null=True)
    canonical_hosted_zone_id = models.TextField(blank=True, null=True)
    created_time = models.DateTimeField(blank=True, null=True)
    scheme = models.TextField()  # This field type is a guess.
    state = models.TextField(blank=True, null=True)  # This field type is a guess.
    load_balancer_type = models.TextField()  # This field type is a guess.
    subnets = models.TextField(blank=True, null=True)  # This field type is a guess.
    availability_zones = models.TextField(blank=True, null=True)  # This field type is a guess.
    ip_address_type = models.TextField()  # This field type is a guess.
    customer_owned_ipv4_pool = models.TextField(blank=True, null=True)
    vpc = models.ForeignKey('Vpc', models.DO_NOTHING, db_column='vpc', blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'load_balancer'


class LoadBalancerSecurityGroups(models.Model):
    load_balancer_name = models.OneToOneField(LoadBalancer, models.DO_NOTHING, db_column='load_balancer_name',
                                              primary_key=True)
    security_group = models.ForeignKey('SecurityGroup', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'load_balancer_security_groups'
        unique_together = (('load_balancer_name', 'security_group'),)


class LogGroup(models.Model):
    log_group_name = models.TextField(primary_key=True)
    log_group_arn = models.TextField(blank=True, null=True)
    creation_time = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'log_group'


class NatGateway(models.Model):
    nat_gateway_id = models.TextField(blank=True, null=True)
    connectivity_type = models.TextField()  # This field type is a guess.
    state = models.TextField(blank=True, null=True)  # This field type is a guess.
    tags = models.TextField(blank=True, null=True)  # This field type is a guess.
    subnet = models.ForeignKey('Subnet', models.DO_NOTHING)
    elastic_ip = models.OneToOneField(ElasticIp, models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'nat_gateway'


class PublicRepository(models.Model):
    repository_name = models.TextField(primary_key=True)
    repository_arn = models.TextField(blank=True, null=True)
    registry_id = models.TextField(blank=True, null=True)
    repository_uri = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'public_repository'


class Repository(models.Model):
    repository_name = models.TextField(primary_key=True)
    repository_arn = models.TextField(blank=True, null=True)
    registry_id = models.TextField(blank=True, null=True)
    repository_uri = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    image_tag_mutability = models.TextField()  # This field type is a guess.
    scan_on_push = models.BooleanField()

    class Meta:
        managed = False
        db_table = 'repository'


class RepositoryPolicy(models.Model):
    registry_id = models.TextField(blank=True, null=True)
    policy_text = models.TextField(blank=True, null=True)
    repository_name = models.OneToOneField(Repository, models.DO_NOTHING, db_column='repository_name')

    class Meta:
        managed = False
        db_table = 'repository_policy'


class Role(models.Model):
    arn = models.TextField(blank=True, null=True)
    role_name = models.TextField(primary_key=True)
    assume_role_policy_document = models.JSONField()
    description = models.TextField(blank=True, null=True)
    attached_policies_arns = ArrayField(models.TextField())

    class Meta:
        managed = False
        db_table = 'iam_role'


class SecurityGroup(models.Model):
    description = models.TextField()
    group_name = models.TextField()
    owner_id = models.TextField(blank=True, null=True)
    group_id = models.TextField(blank=True, null=True)
    vpc = models.ForeignKey('Vpc', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'security_group'
        unique_together = (('group_name', 'vpc'),)


class SecurityGroupRule(models.Model):
    security_group_rule_id = models.TextField(blank=True, null=True)
    is_egress = models.BooleanField()
    ip_protocol = models.TextField()
    from_port = models.IntegerField(blank=True, null=True)
    to_port = models.IntegerField(blank=True, null=True)
    cidr_ipv4 = models.TextField(blank=True, null=True)  # This field type is a guess.
    cidr_ipv6 = models.TextField(blank=True, null=True)  # This field type is a guess.
    prefix_list_id = models.TextField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    security_group = models.ForeignKey(SecurityGroup, models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'security_group_rule'
        unique_together = (('is_egress', 'ip_protocol', 'from_port', 'to_port', 'cidr_ipv4', 'security_group'),)


class Service(models.Model):
    name = models.TextField(primary_key=True)
    arn = models.TextField(blank=True, null=True)
    status = models.TextField(blank=True, null=True)
    desired_count = models.IntegerField()
    subnets = ArrayField(models.TextField())  # This field type is a guess.
    assign_public_ip = models.TextField()  # This field type is a guess.
    cluster_name = models.ForeignKey(Cluster, models.DO_NOTHING, db_column='cluster_name', blank=True, null=True)
    task_definition = models.ForeignKey('TaskDefinition', models.DO_NOTHING, blank=True, null=True)
    target_group_name = models.ForeignKey('TargetGroup', models.DO_NOTHING, db_column='target_group_name', blank=True,
                                          null=True)

    class Meta:
        managed = False
        db_table = 'service'


class ServiceSecurityGroups(models.Model):
    service_name = models.OneToOneField(Service, models.DO_NOTHING, db_column='service_name', primary_key=True)
    security_group = models.ForeignKey(SecurityGroup, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'service_security_groups'
        unique_together = (('service_name', 'security_group'),)


class Subnet(models.Model):
    state = models.TextField(blank=True, null=True)  # This field type is a guess.
    available_ip_address_count = models.IntegerField(blank=True, null=True)
    cidr_block = models.TextField(blank=True, null=True)
    subnet_id = models.TextField(blank=True, null=True)
    owner_id = models.TextField(blank=True, null=True)
    subnet_arn = models.TextField(blank=True, null=True)
    availability_zone = models.ForeignKey(AvailabilityZone, models.DO_NOTHING, db_column='availability_zone')
    vpc = models.ForeignKey('Vpc', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'subnet'


class TargetGroup(models.Model):
    target_group_name = models.TextField(primary_key=True)
    target_type = models.TextField()  # This field type is a guess.
    target_group_arn = models.TextField(blank=True, null=True)
    ip_address_type = models.TextField(blank=True, null=True)  # This field type is a guess.
    protocol = models.TextField(blank=True, null=True)  # This field type is a guess.
    port = models.IntegerField(blank=True, null=True)
    health_check_protocol = models.TextField(blank=True, null=True)  # This field type is a guess.
    health_check_port = models.TextField(blank=True, null=True)
    health_check_enabled = models.BooleanField(blank=True, null=True)
    health_check_interval_seconds = models.IntegerField(blank=True, null=True)
    health_check_timeout_seconds = models.IntegerField(blank=True, null=True)
    healthy_threshold_count = models.IntegerField(blank=True, null=True)
    unhealthy_threshold_count = models.IntegerField(blank=True, null=True)
    health_check_path = models.TextField(blank=True, null=True)
    protocol_version = models.TextField(blank=True, null=True)  # This field type is a guess.
    vpc = models.ForeignKey('Vpc', models.DO_NOTHING, db_column='vpc', blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'target_group'


class TaskDefinition(models.Model):
    task_definition_arn = models.TextField(blank=True, null=True)
    family = models.TextField()
    revision = models.IntegerField(blank=True, null=True)
    status = models.TextField(blank=True, null=True)  # This field type is a guess.
    cpu_memory = models.TextField(blank=True, null=True)  # This field type is a guess.
    task_role_name = models.ForeignKey(Role, models.DO_NOTHING, db_column='task_role_name', blank=True, null=True,
                                       related_name='task_role_name')
    execution_role_name = models.ForeignKey(Role, models.DO_NOTHING, db_column='execution_role_name', blank=True,
                                            null=True, related_name='execution_role_name')

    class Meta:
        managed = False
        db_table = 'task_definition'


class Vpc(models.Model):
    vpc_id = models.TextField(unique=True, blank=True, null=True)
    cidr_block = models.TextField()
    state = models.TextField(blank=True, null=True)  # This field type is a guess.
    is_default = models.BooleanField()
    tags = models.TextField(blank=True, null=True)  # This field type is a guess.

    class Meta:
        managed = False
        db_table = 'vpc'
