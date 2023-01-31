---
id: "sql"
title: "SQL reference per module"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

### aws_account

[aws_credentials](classes/aws_account_entity.AwsCredentials.md)

[aws_regions](classes/aws_account_entity.AwsRegions.md)

### aws_acm

[certificate_renewal_eligibility](enums/aws_acm_entity_certificate.certificateRenewalEligibilityEnum.md)

[certificate_status](enums/aws_acm_entity_certificate.certificateStatusEnum.md)

[certificate_type](enums/aws_acm_entity_certificate.certificateTypeEnum.md)

[certificate](classes/aws_acm_entity_certificate.Certificate.md)

[certificate_import](classes/aws_acm_rpcs_import.CertificateImportRpc.md)

[certificate_request](classes/aws_acm_rpcs_request.CertificateRequestRpc.md)

### aws_api_gateway

[protocol](enums/aws_api_gateway_entity_api.Protocol.md)

[api](classes/aws_api_gateway_entity_api.Api.md)

### aws_appsync

[authentication_type](enums/aws_appsync_entity_graphql_api.AuthenticationType.md)

[default_action](enums/aws_appsync_entity_graphql_api.DefaultAction.md)

[graphql_api](classes/aws_appsync_entity_graphql_api.GraphqlApi.md)

### aws_cloudfront

[origin_protocol_policy](enums/aws_cloudfront_entity_distribution.originProtocolPolicyEnum.md)

[viewer_protocol_policy](enums/aws_cloudfront_entity_distribution.viewerProtocolPolicyEnum.md)

[distribution](classes/aws_cloudfront_entity_distribution.Distribution.md)

### aws_cloudwatch

[log_group](classes/aws_cloudwatch_entity_log_group.LogGroup.md)

[comparison_operator](enums/aws_cloudwatch_entity_metric_alarm.comparisonOperatorEnum.md)

[evaluate_low_sample_count_percentile](enums/aws_cloudwatch_entity_metric_alarm.evaluateLowSampleCountPercentileEnum.md)

[standard_unit](enums/aws_cloudwatch_entity_metric_alarm.standardUnitEnum.md)

[statistic](enums/aws_cloudwatch_entity_metric_alarm.statisticEnum.md)

[treat_missing_data](enums/aws_cloudwatch_entity_metric_alarm.treatMissingDataEnum.md)

[metric_alarm](classes/aws_cloudwatch_entity_metric_alarm.MetricAlarm.md)

[log_group_tail](classes/aws_cloudwatch_rpcs_log_group_tail.LogGroupTailRpc.md)

### aws_codebuild

[build_status](enums/aws_codebuild_entity_build.BuildStatus.md)

[codebuild_build_list](classes/aws_codebuild_entity_build.CodebuildBuildList.md)

[compute_type](enums/aws_codebuild_entity_project.ComputeType.md)

[environment_type](enums/aws_codebuild_entity_project.EnvironmentType.md)

[environment_variable_type](enums/aws_codebuild_entity_project.EnvironmentVariableType.md)

[source_type](enums/aws_codebuild_entity_project.SourceType.md)

[codebuild_project](classes/aws_codebuild_entity_project.CodebuildProject.md)

[auth_type](enums/aws_codebuild_entity_source_credentials.AuthType.md)

[source_credentials_list](classes/aws_codebuild_entity_source_credentials.SourceCredentialsList.md)

[valid_auth_types](enums/aws_codebuild_rpcs_import_source_credential.ValidAuthTypes.md)

[valid_server_types](enums/aws_codebuild_rpcs_import_source_credential.ValidServerTypes.md)

[import_source_credential](classes/aws_codebuild_rpcs_import_source_credential.ImportSourceCredentialRpc.md)

[start_build](classes/aws_codebuild_rpcs_start_build.StartBuildRPC.md)

### aws_codedeploy

[compute_platform](enums/aws_codedeploy_entity_application.ComputePlatform.md)

[codedeploy_application](classes/aws_codedeploy_entity_application.CodedeployApplication.md)

[deployment_status](enums/aws_codedeploy_entity_deployment.DeploymentStatusEnum.md)

[revision_type](enums/aws_codedeploy_entity_deployment.RevisionType.md)

[codedeploy_deployment](classes/aws_codedeploy_entity_deployment.CodedeployDeployment.md)

[deployment_config_type](enums/aws_codedeploy_entity_deploymentGroup.DeploymentConfigType.md)

[ec2_tag_filter_type](enums/aws_codedeploy_entity_deploymentGroup.EC2TagFilterType.md)

[codedeploy_deployment_group](classes/aws_codedeploy_entity_deploymentGroup.CodedeployDeploymentGroup.md)

[start_deploy](classes/aws_codedeploy_rpcs_start_deploy.StartDeployRPC.md)

### aws_codepipeline

[action_category](enums/aws_codepipeline_entity_pipeline_declaration.ActionCategory.md)

[pipeline_declaration](classes/aws_codepipeline_entity_pipeline_declaration.PipelineDeclaration.md)

### aws_dynamo

[table_class](enums/aws_dynamo_entity.TableClass.md)

[dynamo_table](classes/aws_dynamo_entity.DynamoTable.md)

### aws_ec2

[general_purpose_volume_type](enums/aws_ec2_entity_general_purpose_volume.GeneralPurposeVolumeType.md)

[volume_state](enums/aws_ec2_entity_general_purpose_volume.VolumeState.md)

[general_purpose_volume](classes/aws_ec2_entity_general_purpose_volume.GeneralPurposeVolume.md)

[state](enums/aws_ec2_entity_instance.State.md)

[instance](classes/aws_ec2_entity_instance.Instance.md)

[key_pair](classes/aws_ec2_entity_key_pair.KeyPair.md)

[registered_instance](classes/aws_ec2_entity_registered_instance.RegisteredInstance.md)

[key_pair_import](classes/aws_ec2_rpcs_import.KeyPairImportRpc.md)

[key_pair_request](classes/aws_ec2_rpcs_request.KeyPairRequestRpc.md)

[architecture](enums/aws_ec2_metadata_entity_instance_metadata.Architecture.md)

[root_device_type](enums/aws_ec2_metadata_entity_instance_metadata.RootDeviceType.md)

[instance_metadata](classes/aws_ec2_metadata_entity_instance_metadata.InstanceMetadata.md)

### aws_ec2_metadata

[architecture](enums/aws_ec2_metadata_entity_instance_metadata.Architecture.md)

[root_device_type](enums/aws_ec2_metadata_entity_instance_metadata.RootDeviceType.md)

[instance_metadata](classes/aws_ec2_metadata_entity_instance_metadata.InstanceMetadata.md)

### aws_ecr

[public_repository](classes/aws_ecr_entity_public_repository.PublicRepository.md)

[image_tag_mutability](enums/aws_ecr_entity_repository.ImageTagMutability.md)

[repository](classes/aws_ecr_entity_repository.Repository.md)

[repository_image](classes/aws_ecr_entity_repository_image.RepositoryImage.md)

[repository_policy](classes/aws_ecr_entity_repository_policy.RepositoryPolicy.md)

[ecr_build](classes/aws_ecr_rpcs_build.EcrBuildRpc.md)

### aws_ecs_fargate

[cluster](classes/aws_ecs_fargate_entity_cluster.Cluster.md)

[transport_protocol](enums/aws_ecs_fargate_entity_container_definition.TransportProtocol.md)

[container_definition](classes/aws_ecs_fargate_entity_container_definition.ContainerDefinition.md)

[assign_public_ip](enums/aws_ecs_fargate_entity_service.AssignPublicIp.md)

[service](classes/aws_ecs_fargate_entity_service.Service.md)

[cpu_mem_combination](enums/aws_ecs_fargate_entity_task_definition.CpuMemCombination.md)

[task_definition_status](enums/aws_ecs_fargate_entity_task_definition.TaskDefinitionStatus.md)

[task_definition](classes/aws_ecs_fargate_entity_task_definition.TaskDefinition.md)

[deploy_service](classes/aws_ecs_fargate_rpcs_deploy_service.DeployServiceRPC.md)

### aws_elasticache

[engine](enums/aws_elasticache_entity_cache_cluster.Engine.md)

[cache_cluster](classes/aws_elasticache_entity_cache_cluster.CacheCluster.md)

### aws_elb

[action_type](enums/aws_elb_entity_listener.ActionTypeEnum.md)

[listener](classes/aws_elb_entity_listener.Listener.md)

[ip_address_type](enums/aws_elb_entity_load_balancer.IpAddressType.md)

[load_balancer_scheme](enums/aws_elb_entity_load_balancer.LoadBalancerSchemeEnum.md)

[load_balancer_state](enums/aws_elb_entity_load_balancer.LoadBalancerStateEnum.md)

[load_balancer_type](enums/aws_elb_entity_load_balancer.LoadBalancerTypeEnum.md)

[load_balancer](classes/aws_elb_entity_load_balancer.LoadBalancer.md)

[protocol](enums/aws_elb_entity_target_group.ProtocolEnum.md)

[protocol_version](enums/aws_elb_entity_target_group.ProtocolVersionEnum.md)

[target_group_ip_address_type](enums/aws_elb_entity_target_group.TargetGroupIpAddressTypeEnum.md)

[target_type](enums/aws_elb_entity_target_group.TargetTypeEnum.md)

[target_group](classes/aws_elb_entity_target_group.TargetGroup.md)

### aws_iam

[access_key_status](enums/aws_iam_entity_access_key.accessKeyStatusEnum.md)

[access_key](classes/aws_iam_entity_access_key.AccessKey.md)

[iam_role](classes/aws_iam_entity_role.IamRole.md)

[iam_user](classes/aws_iam_entity_user.IamUser.md)

[access_key_request](classes/aws_iam_rpcs_request.AccessKeyRequestRpc.md)

[set_user_password_request](classes/aws_iam_rpcs_set_password.SetUserPasswordRequestRpc.md)

### aws_lambda

[architecture](enums/aws_lambda_entity_lambda_function.Architecture.md)

[package_type](enums/aws_lambda_entity_lambda_function.PackageType.md)

[runtime](enums/aws_lambda_entity_lambda_function.Runtime.md)

[lambda_function](classes/aws_lambda_entity_lambda_function.LambdaFunction.md)

[lambda_function_invoke](classes/aws_lambda_rpcs_invoke.LambdaFunctionInvokeRpc.md)

### aws_memory_db

[node_type](enums/aws_memory_db_entity_memory_db_cluster.NodeTypeEnum.md)

[memory_db_cluster](classes/aws_memory_db_entity_memory_db_cluster.MemoryDBCluster.md)

[subnet_group](classes/aws_memory_db_entity_subnet_group.SubnetGroup.md)

### aws_rds

[parameter_group_family](enums/aws_rds_entity_parameter_group.ParameterGroupFamily.md)

[parameter_group](classes/aws_rds_entity_parameter_group.ParameterGroup.md)

[RDS](classes/aws_rds_entity_rds.RDS.md)

### aws_route53

[alias_target](classes/aws_route53_entity_alias_target.AliasTarget.md)

[hosted_zone](classes/aws_route53_entity_hosted_zone.HostedZone.md)

[record_type](enums/aws_route53_entity_resource_records_set.RecordType.md)

[resource_record_set](classes/aws_route53_entity_resource_records_set.ResourceRecordSet.md)

### aws_s3

[bucket](classes/aws_s3_entity_bucket.Bucket.md)

[bucket_object](classes/aws_s3_entity_bucket_object.BucketObject.md)

[bucket_website](classes/aws_s3_entity_bucket_website.BucketWebsite.md)

[public_access_block](classes/aws_s3_entity_public_access_block.PublicAccessBlock.md)

[s3_upload_object](classes/aws_s3_rpcs_s3_upload_object.S3UploadObjectRpc.md)

### aws_sdk

### aws_secrets_manager

[secret](classes/aws_secrets_manager_entity_secret.Secret.md)

### aws_security_group

[security_group](classes/aws_security_group_entity.SecurityGroup.md)

[security_group_rule](classes/aws_security_group_entity.SecurityGroupRule.md)

### aws_sns

[topic](classes/aws_sns_entity_topic.Topic.md)

### aws_vpc

[availability_zone](classes/aws_vpc_entity_availability_zone.AvailabilityZone.md)

[elastic_ip](classes/aws_vpc_entity_elastic_ip.ElasticIp.md)

[endpoint_gateway_service](enums/aws_vpc_entity_endpoint_gateway.EndpointGatewayService.md)

[endpoint_gateway](classes/aws_vpc_entity_endpoint_gateway.EndpointGateway.md)

[endpoint_interface_service](enums/aws_vpc_entity_endpoint_interface.EndpointInterfaceService.md)

[endpoint_interface](classes/aws_vpc_entity_endpoint_interface.EndpointInterface.md)

[internet_gateway](classes/aws_vpc_entity_internet_gateway.InternetGateway.md)

[connectivity_type](enums/aws_vpc_entity_nat_gateway.ConnectivityType.md)

[nat_gateway_state](enums/aws_vpc_entity_nat_gateway.NatGatewayState.md)

[nat_gateway](classes/aws_vpc_entity_nat_gateway.NatGateway.md)

[peering_connection_state](enums/aws_vpc_entity_peering_connection.PeeringConnectionState.md)

[peering_connection](classes/aws_vpc_entity_peering_connection.PeeringConnection.md)

[route](classes/aws_vpc_entity_route.Route.md)

[route_table](classes/aws_vpc_entity_route_table.RouteTable.md)

[route_table_association](classes/aws_vpc_entity_route_table_association.RouteTableAssociation.md)

[subnet_state](enums/aws_vpc_entity_subnet.SubnetState.md)

[subnet](classes/aws_vpc_entity_subnet.Subnet.md)

[vpc_state](enums/aws_vpc_entity_vpc.VpcState.md)

[vpc](classes/aws_vpc_entity_vpc.Vpc.md)

### iasql_functions

[iasql_begin](classes/iasql_functions_rpcs_iasql_begin.IasqlBegin.md)

[iasql_commit](classes/iasql_functions_rpcs_iasql_commit.IasqlCommit.md)

[iasql_get_errors](classes/iasql_functions_rpcs_iasql_get_errors.IasqlGetErrors.md)

[iasql_get_sql_since](classes/iasql_functions_rpcs_iasql_get_sql_since.IasqlGetSqlSince.md)

[iasql_install](classes/iasql_functions_rpcs_iasql_install.IasqlInstall.md)

[iasql_preview](classes/iasql_functions_rpcs_iasql_preview.IasqlPreview.md)

[iasql_rollback](classes/iasql_functions_rpcs_iasql_rollback.IasqlRollback.md)

[iasql_uninstall](classes/iasql_functions_rpcs_iasql_uninstall.IasqlUninstall.md)
