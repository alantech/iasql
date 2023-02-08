---
id: "index"
title: "SQL reference per module"
displayed_sidebar: "docs"
sidebar_label: "Reference"
sidebar_position: 0
hide_table_of_contents: true
custom_edit_url: null
---

### [iasql_functions](modules/iasql_functions.md)

&nbsp;&nbsp;**Functions**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[iasql_begin](classes/iasql_functions_rpcs_iasql_begin.IasqlBegin.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[iasql_commit](classes/iasql_functions_rpcs_iasql_commit.IasqlCommit.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[iasql_get_errors](classes/iasql_functions_rpcs_iasql_get_errors.IasqlGetErrors.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[iasql_get_sql_since](classes/iasql_functions_rpcs_iasql_get_sql_since.IasqlGetSqlSince.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[iasql_install](classes/iasql_functions_rpcs_iasql_install.IasqlInstall.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[iasql_modules_list](classes/iasql_functions_rpcs_iasql_modules_list.IasqlModulesList.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[iasql_preview](classes/iasql_functions_rpcs_iasql_preview.IasqlPreview.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[iasql_rollback](classes/iasql_functions_rpcs_iasql_rollback.IasqlRollback.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[iasql_uninstall](classes/iasql_functions_rpcs_iasql_uninstall.IasqlUninstall.md)

### [aws_account](modules/aws_account.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[aws_credentials](classes/aws_account_entity.AwsCredentials.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[aws_regions](classes/aws_account_entity.AwsRegions.md)

### [aws_acm](modules/aws_acm.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[certificate](classes/aws_acm_entity_certificate.Certificate.md)

&nbsp;&nbsp;**Functions**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[certificate_import](classes/aws_acm_rpcs_import.CertificateImportRpc.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[certificate_request](classes/aws_acm_rpcs_request.CertificateRequestRpc.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[certificate_renewal_eligibility](enums/aws_acm_entity_certificate.certificateRenewalEligibilityEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[certificate_status](enums/aws_acm_entity_certificate.certificateStatusEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[certificate_type](enums/aws_acm_entity_certificate.certificateTypeEnum.md)

### [aws_api_gateway](modules/aws_api_gateway.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[api](classes/aws_api_gateway_entity_api.Api.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[protocol](enums/aws_api_gateway_entity_api.Protocol.md)

### [aws_appsync](modules/aws_appsync.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[graphql_api](classes/aws_appsync_entity_graphql_api.GraphqlApi.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[authentication_type](enums/aws_appsync_entity_graphql_api.AuthenticationType.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[default_action](enums/aws_appsync_entity_graphql_api.DefaultAction.md)

### [aws_cloudfront](modules/aws_cloudfront.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[distribution](classes/aws_cloudfront_entity_distribution.Distribution.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[origin_protocol_policy](enums/aws_cloudfront_entity_distribution.originProtocolPolicyEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[viewer_protocol_policy](enums/aws_cloudfront_entity_distribution.viewerProtocolPolicyEnum.md)

### [aws_cloudwatch](modules/aws_cloudwatch.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[log_group](classes/aws_cloudwatch_entity_log_group.LogGroup.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[metric_alarm](classes/aws_cloudwatch_entity_metric_alarm.MetricAlarm.md)

&nbsp;&nbsp;**Functions**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[log_group_tail](classes/aws_cloudwatch_rpcs_log_group_tail.LogGroupTailRpc.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[comparison_operator](enums/aws_cloudwatch_entity_metric_alarm.comparisonOperatorEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[evaluate_low_sample_count_percentile](enums/aws_cloudwatch_entity_metric_alarm.evaluateLowSampleCountPercentileEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[standard_unit](enums/aws_cloudwatch_entity_metric_alarm.standardUnitEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[statistic](enums/aws_cloudwatch_entity_metric_alarm.statisticEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[treat_missing_data](enums/aws_cloudwatch_entity_metric_alarm.treatMissingDataEnum.md)

### [aws_codebuild](modules/aws_codebuild.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[codebuild_build_list](classes/aws_codebuild_entity_build.CodebuildBuildList.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[codebuild_project](classes/aws_codebuild_entity_project.CodebuildProject.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[source_credentials_list](classes/aws_codebuild_entity_source_credentials.SourceCredentialsList.md)

&nbsp;&nbsp;**Functions**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[import_source_credential](classes/aws_codebuild_rpcs_import_source_credential.ImportSourceCredentialRpc.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[start_build](classes/aws_codebuild_rpcs_start_build.StartBuildRPC.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[build_status](enums/aws_codebuild_entity_build.BuildStatus.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[compute_type](enums/aws_codebuild_entity_project.ComputeType.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[environment_type](enums/aws_codebuild_entity_project.EnvironmentType.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[environment_variable_type](enums/aws_codebuild_entity_project.EnvironmentVariableType.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[source_type](enums/aws_codebuild_entity_project.SourceType.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[auth_type](enums/aws_codebuild_entity_source_credentials.AuthType.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[valid_auth_types](enums/aws_codebuild_rpcs_import_source_credential.ValidAuthTypes.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[valid_server_types](enums/aws_codebuild_rpcs_import_source_credential.ValidServerTypes.md)

### [aws_codedeploy](modules/aws_codedeploy.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[codedeploy_application](classes/aws_codedeploy_entity_application.CodedeployApplication.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[codedeploy_deployment](classes/aws_codedeploy_entity_deployment.CodedeployDeployment.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[codedeploy_deployment_group](classes/aws_codedeploy_entity_deploymentGroup.CodedeployDeploymentGroup.md)

&nbsp;&nbsp;**Functions**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[start_deploy](classes/aws_codedeploy_rpcs_start_deploy.StartDeployRPC.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[compute_platform](enums/aws_codedeploy_entity_application.ComputePlatform.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[deployment_status](enums/aws_codedeploy_entity_deployment.DeploymentStatusEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[revision_type](enums/aws_codedeploy_entity_deployment.RevisionType.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[deployment_config_type](enums/aws_codedeploy_entity_deploymentGroup.DeploymentConfigType.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[deployment_option](enums/aws_codedeploy_entity_deploymentGroup.DeploymentOption.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[deployment_type](enums/aws_codedeploy_entity_deploymentGroup.DeploymentType.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[ec2_tag_filter_type](enums/aws_codedeploy_entity_deploymentGroup.EC2TagFilterType.md)

### [aws_codepipeline](modules/aws_codepipeline.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[pipeline_declaration](classes/aws_codepipeline_entity_pipeline_declaration.PipelineDeclaration.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[action_category](enums/aws_codepipeline_entity_pipeline_declaration.ActionCategory.md)

### [aws_dynamo](modules/aws_dynamo.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[dynamo_table](classes/aws_dynamo_entity.DynamoTable.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[table_class](enums/aws_dynamo_entity.TableClass.md)

### [aws_ec2](modules/aws_ec2.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[general_purpose_volume](classes/aws_ec2_entity_general_purpose_volume.GeneralPurposeVolume.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[instance](classes/aws_ec2_entity_instance.Instance.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[key_pair](classes/aws_ec2_entity_key_pair.KeyPair.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[registered_instance](classes/aws_ec2_entity_registered_instance.RegisteredInstance.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[instance_metadata](classes/aws_ec2_metadata_entity_instance_metadata.InstanceMetadata.md)

&nbsp;&nbsp;**Functions**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[key_pair_import](classes/aws_ec2_rpcs_import.KeyPairImportRpc.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[key_pair_request](classes/aws_ec2_rpcs_request.KeyPairRequestRpc.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[general_purpose_volume_type](enums/aws_ec2_entity_general_purpose_volume.GeneralPurposeVolumeType.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[volume_state](enums/aws_ec2_entity_general_purpose_volume.VolumeState.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[state](enums/aws_ec2_entity_instance.State.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[architecture](enums/aws_ec2_metadata_entity_instance_metadata.Architecture.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[root_device_type](enums/aws_ec2_metadata_entity_instance_metadata.RootDeviceType.md)

### [aws_ec2_metadata](modules/aws_ec2_metadata.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[instance_metadata](classes/aws_ec2_metadata_entity_instance_metadata.InstanceMetadata.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[architecture](enums/aws_ec2_metadata_entity_instance_metadata.Architecture.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[root_device_type](enums/aws_ec2_metadata_entity_instance_metadata.RootDeviceType.md)

### [aws_ecr](modules/aws_ecr.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[public_repository](classes/aws_ecr_entity_public_repository.PublicRepository.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[repository](classes/aws_ecr_entity_repository.Repository.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[repository_image](classes/aws_ecr_entity_repository_image.RepositoryImage.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[repository_policy](classes/aws_ecr_entity_repository_policy.RepositoryPolicy.md)

&nbsp;&nbsp;**Functions**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[ecr_build](classes/aws_ecr_rpcs_build.EcrBuildRpc.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[image_tag_mutability](enums/aws_ecr_entity_repository.ImageTagMutability.md)

### [aws_ecs_fargate](modules/aws_ecs_fargate.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[cluster](classes/aws_ecs_fargate_entity_cluster.Cluster.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[container_definition](classes/aws_ecs_fargate_entity_container_definition.ContainerDefinition.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[service](classes/aws_ecs_fargate_entity_service.Service.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[task_definition](classes/aws_ecs_fargate_entity_task_definition.TaskDefinition.md)

&nbsp;&nbsp;**Functions**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[deploy_service](classes/aws_ecs_fargate_rpcs_deploy_service.DeployServiceRPC.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[transport_protocol](enums/aws_ecs_fargate_entity_container_definition.TransportProtocol.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[assign_public_ip](enums/aws_ecs_fargate_entity_service.AssignPublicIp.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[cpu_mem_combination](enums/aws_ecs_fargate_entity_task_definition.CpuMemCombination.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[task_definition_status](enums/aws_ecs_fargate_entity_task_definition.TaskDefinitionStatus.md)

### [aws_elasticache](modules/aws_elasticache.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[cache_cluster](classes/aws_elasticache_entity_cache_cluster.CacheCluster.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[engine](enums/aws_elasticache_entity_cache_cluster.Engine.md)

### [aws_elb](modules/aws_elb.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[listener](classes/aws_elb_entity_listener.Listener.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[load_balancer](classes/aws_elb_entity_load_balancer.LoadBalancer.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[target_group](classes/aws_elb_entity_target_group.TargetGroup.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[action_type](enums/aws_elb_entity_listener.ActionTypeEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[ip_address_type](enums/aws_elb_entity_load_balancer.IpAddressType.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[load_balancer_scheme](enums/aws_elb_entity_load_balancer.LoadBalancerSchemeEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[load_balancer_state](enums/aws_elb_entity_load_balancer.LoadBalancerStateEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[load_balancer_type](enums/aws_elb_entity_load_balancer.LoadBalancerTypeEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[protocol](enums/aws_elb_entity_target_group.ProtocolEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[protocol_version](enums/aws_elb_entity_target_group.ProtocolVersionEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[target_group_ip_address_type](enums/aws_elb_entity_target_group.TargetGroupIpAddressTypeEnum.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[target_type](enums/aws_elb_entity_target_group.TargetTypeEnum.md)

### [aws_iam](modules/aws_iam.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[access_key](classes/aws_iam_entity_access_key.AccessKey.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[iam_role](classes/aws_iam_entity_role.IamRole.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[iam_user](classes/aws_iam_entity_user.IamUser.md)

&nbsp;&nbsp;**Functions**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[access_key_request](classes/aws_iam_rpcs_request.AccessKeyRequestRpc.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[set_user_password_request](classes/aws_iam_rpcs_set_password.SetUserPasswordRequestRpc.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[access_key_status](enums/aws_iam_entity_access_key.accessKeyStatusEnum.md)

### [aws_lambda](modules/aws_lambda.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[lambda_function](classes/aws_lambda_entity_lambda_function.LambdaFunction.md)

&nbsp;&nbsp;**Functions**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[lambda_function_invoke](classes/aws_lambda_rpcs_invoke.LambdaFunctionInvokeRpc.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[architecture](enums/aws_lambda_entity_lambda_function.Architecture.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[package_type](enums/aws_lambda_entity_lambda_function.PackageType.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[runtime](enums/aws_lambda_entity_lambda_function.Runtime.md)

### [aws_memory_db](modules/aws_memory_db.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[memory_db_cluster](classes/aws_memory_db_entity_memory_db_cluster.MemoryDBCluster.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[subnet_group](classes/aws_memory_db_entity_subnet_group.SubnetGroup.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[node_type](enums/aws_memory_db_entity_memory_db_cluster.NodeTypeEnum.md)

### [aws_rds](modules/aws_rds.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[parameter_group](classes/aws_rds_entity_parameter_group.ParameterGroup.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[RDS](classes/aws_rds_entity_rds.RDS.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[parameter_group_family](enums/aws_rds_entity_parameter_group.ParameterGroupFamily.md)

### [aws_route53](modules/aws_route53.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[alias_target](classes/aws_route53_entity_alias_target.AliasTarget.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[hosted_zone](classes/aws_route53_entity_hosted_zone.HostedZone.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[resource_record_set](classes/aws_route53_entity_resource_records_set.ResourceRecordSet.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[record_type](enums/aws_route53_entity_resource_records_set.RecordType.md)

### [aws_s3](modules/aws_s3.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[bucket](classes/aws_s3_entity_bucket.Bucket.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[bucket_object](classes/aws_s3_entity_bucket_object.BucketObject.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[bucket_website](classes/aws_s3_entity_bucket_website.BucketWebsite.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[public_access_block](classes/aws_s3_entity_public_access_block.PublicAccessBlock.md)

&nbsp;&nbsp;**Functions**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[s3_upload_object](classes/aws_s3_rpcs_s3_upload_object.S3UploadObjectRpc.md)

### [aws_sdk](modules/aws_sdk.md)

### [aws_secrets_manager](modules/aws_secrets_manager.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[secret](classes/aws_secrets_manager_entity_secret.Secret.md)

### [aws_security_group](modules/aws_security_group.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[security_group](classes/aws_security_group_entity.SecurityGroup.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[security_group_rule](classes/aws_security_group_entity.SecurityGroupRule.md)

### [aws_sns](modules/aws_sns.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[topic](classes/aws_sns_entity_topic.Topic.md)

### [aws_vpc](modules/aws_vpc.md)

&nbsp;&nbsp;**Tables**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[availability_zone](classes/aws_vpc_entity_availability_zone.AvailabilityZone.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[elastic_ip](classes/aws_vpc_entity_elastic_ip.ElasticIp.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[endpoint_gateway](classes/aws_vpc_entity_endpoint_gateway.EndpointGateway.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[endpoint_interface](classes/aws_vpc_entity_endpoint_interface.EndpointInterface.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[internet_gateway](classes/aws_vpc_entity_internet_gateway.InternetGateway.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[nat_gateway](classes/aws_vpc_entity_nat_gateway.NatGateway.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[peering_connection](classes/aws_vpc_entity_peering_connection.PeeringConnection.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[route](classes/aws_vpc_entity_route.Route.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[route_table](classes/aws_vpc_entity_route_table.RouteTable.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[route_table_association](classes/aws_vpc_entity_route_table_association.RouteTableAssociation.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[subnet](classes/aws_vpc_entity_subnet.Subnet.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[vpc](classes/aws_vpc_entity_vpc.Vpc.md)

&nbsp;&nbsp;**Enums**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[endpoint_gateway_service](enums/aws_vpc_entity_endpoint_gateway.EndpointGatewayService.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[endpoint_interface_service](enums/aws_vpc_entity_endpoint_interface.EndpointInterfaceService.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[connectivity_type](enums/aws_vpc_entity_nat_gateway.ConnectivityType.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[nat_gateway_state](enums/aws_vpc_entity_nat_gateway.NatGatewayState.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[peering_connection_state](enums/aws_vpc_entity_peering_connection.PeeringConnectionState.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[subnet_state](enums/aws_vpc_entity_subnet.SubnetState.md)

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[vpc_state](enums/aws_vpc_entity_vpc.VpcState.md)
