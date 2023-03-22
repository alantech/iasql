import {
  AutoTuneDesiredState,
  CreateDomainCommandInput,
  DescribeDomainsCommandInput,
  DomainStatus as AwsDomain,
  OpenSearch,
  OpenSearchPartitionInstanceType,
  OpenSearchWarmPartitionInstanceType,
} from '@aws-sdk/client-opensearch';
import { DomainInfo } from '@aws-sdk/client-opensearch/dist-types/models/models_0';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AWS } from '../../../services/aws_macros';
import { Policy } from '../../../services/canonical-iam-policy';
import { awsAcmModule } from '../../aws_acm';
import { awsSecurityGroupModule } from '../../aws_security_group';
import { awsVpcModule } from '../../aws_vpc';
import { Context, Crud, MapperBase } from '../../interfaces';
import { Domain } from '../entity';
import { AwsOpenSearchModule } from '../index';

export class DomainMapper extends MapperBase<Domain> {
  module: AwsOpenSearchModule;
  entity = Domain;
  equals = (a: Domain, b: Domain) => true;

  private async waitForCreation(client: OpenSearch, domainName: string) {
    await createWaiter<OpenSearch, DescribeDomainsCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      { DomainNames: [domainName] },
      async (cl, cmd) => {
        const data = await cl.describeDomains(cmd);
        if (!!data.DomainStatusList?.[0].Endpoint && data.DomainStatusList?.[0].Processing === false)
          return { state: WaiterState.SUCCESS };
        else return { state: WaiterState.RETRY };
      },
    );
  }

  private async domainMapper(domain: AwsDomain, region: string, ctx: Context) {
    const out: Domain = new Domain();
    if (domain.Deleted) return undefined;

    out.domainName = domain.DomainName!;
    if (domain.DomainEndpointOptions?.CustomEndpoint) {
      const certificateId = awsAcmModule.certificate.generateId({
        arn: domain.DomainEndpointOptions?.CustomEndpointCertificateArn ?? '',
      });
      out.customEndpoint = domain.DomainEndpointOptions.CustomEndpoint;
      out.customEndpointCertificate =
        (await awsAcmModule.certificate.db.read(ctx, certificateId)) ??
        (await awsAcmModule.certificate.cloud.read(ctx, certificateId));
    }
    out.version = domain.EngineVersion!;
    if (!domain.ClusterConfig?.ZoneAwarenessConfig?.AvailabilityZoneCount) out.availabilityZoneCount = 1;
    else out.availabilityZoneCount = domain.ClusterConfig.ZoneAwarenessConfig.AvailabilityZoneCount;
    out.instanceType = domain.ClusterConfig?.InstanceType as OpenSearchPartitionInstanceType;
    out.instanceCount = domain.ClusterConfig?.InstanceCount!;
    out.ebsOptions = domain.EBSOptions;
    out.warmInstanceType = domain.ClusterConfig?.WarmType as OpenSearchWarmPartitionInstanceType | undefined;
    out.warmInstanceCount = domain.ClusterConfig?.WarmCount;
    out.coldStorage = domain.ClusterConfig?.ColdStorageOptions?.Enabled;
    out.dedicatedMasterType = domain.ClusterConfig?.DedicatedMasterType as
      | OpenSearchPartitionInstanceType
      | undefined;
    out.autoTune = ['ENABLED', 'ENABLE_IN_PROGRESS'].includes(domain.AutoTuneOptions?.State ?? '');
    if (domain.VPCOptions?.SubnetIds && domain.VPCOptions.SecurityGroupIds) {
      out.subnets = [];
      domain.VPCOptions.SubnetIds.map(async subnetId => {
        const subnetMapperId = awsVpcModule.subnet.generateId({ subnetId, region });
        out.subnets!.push(
          (await awsVpcModule.subnet.db.read(ctx, subnetMapperId)) ??
            (await awsVpcModule.subnet.cloud.read(ctx, subnetMapperId)),
        );
      });
      out.securityGroups = [];
      domain.VPCOptions.SecurityGroupIds.map(async groupId => {
        const sgMapperId = awsSecurityGroupModule.securityGroup.generateId({ groupId, region });
        out.securityGroups!.push(
          (await awsSecurityGroupModule.securityGroup.db.read(ctx, sgMapperId)) ??
            (await awsSecurityGroupModule.securityGroup.cloud.read(ctx, sgMapperId)),
        );
      });
    }
    out.enableFineGrainedAccessControl = !!domain.AdvancedSecurityOptions?.Enabled;
    out.accessPolicy = JSON.parse(domain.AccessPolicies!) as Policy;
    out.region = region;
    out.endpoint = domain.Endpoint;

    return out;
  }

  cloud = new Crud({
    create: async (es: Domain[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const input: CreateDomainCommandInput = {
          DomainName: e.domainName,
          EngineVersion: e.version,
          ClusterConfig: {
            InstanceType: e.instanceType,
            InstanceCount: e.instanceCount,
            DedicatedMasterEnabled: !!e.dedicatedMasterCount,
            ZoneAwarenessEnabled: e.availabilityZoneCount > 1,
            DedicatedMasterType: e.dedicatedMasterType,
            DedicatedMasterCount: e.dedicatedMasterCount,
            WarmEnabled: !!e.warmInstanceCount,
            WarmType: e.warmInstanceType,
            WarmCount: e.warmInstanceCount,
            ColdStorageOptions: {
              Enabled: e.coldStorage,
            },
          },
          AccessPolicies: JSON.stringify(e.accessPolicy),
          SnapshotOptions: {
            AutomatedSnapshotStartHour: 0, // input?
          },
          EncryptionAtRestOptions: { Enabled: true },
          NodeToNodeEncryptionOptions: { Enabled: true },
          AutoTuneOptions: {
            DesiredState:
              e.instanceType.includes('t2.') || e.instanceType.includes('t3.')
                ? AutoTuneDesiredState.DISABLED
                : AutoTuneDesiredState.ENABLED,
            UseOffPeakWindow: true,
          },
          OffPeakWindowOptions: {
            Enabled: true,
            OffPeakWindow: { WindowStartTime: { Hours: 0, Minutes: 0 } }, // TODO: maybe input?
          },
          SoftwareUpdateOptions: { AutoSoftwareUpdateEnabled: true },
        };
        if (e.availabilityZoneCount > 1)
          input.ClusterConfig!.ZoneAwarenessConfig = {
            AvailabilityZoneCount: e.availabilityZoneCount,
          };
        if (!!e.subnets?.length && !!e.securityGroups?.length)
          input.VPCOptions = {
            SubnetIds: e.subnets.map(s => s.subnetId!),
            SecurityGroupIds: e.securityGroups.map(sg => sg.groupId!),
          };
        if (e.ebsOptions) input.EBSOptions = e.ebsOptions;
        if (e.customEndpoint && e.customEndpointCertificate)
          input.DomainEndpointOptions = {
            EnforceHTTPS: true,
            TLSSecurityPolicy: 'Policy-Min-TLS-1-0-2019-07',
            CustomEndpointEnabled: !!e.customEndpoint,
            CustomEndpoint: e.customEndpoint,
            CustomEndpointCertificateArn: e.customEndpointCertificate.arn,
          };
        if (
          (e.fineGrainedAccessControlMasterUsername && e.fineGrainedAccessControlMasterPassword) ||
          e.fineGrainedAccessControlUserArn
        ) {
          input.DomainEndpointOptions = input.DomainEndpointOptions ?? {};
          input.DomainEndpointOptions.EnforceHTTPS = true;
          input.DomainEndpointOptions.TLSSecurityPolicy = 'Policy-Min-TLS-1-0-2019-07';

          input.AdvancedSecurityOptions = {
            Enabled: true,
            InternalUserDatabaseEnabled: !e.fineGrainedAccessControlUserArn,
          };
          if (e.fineGrainedAccessControlUserArn)
            input.AdvancedSecurityOptions.MasterUserOptions = {
              MasterUserARN: e.fineGrainedAccessControlUserArn,
            };
          else
            input.AdvancedSecurityOptions.MasterUserOptions = {
              MasterUserName: e.fineGrainedAccessControlMasterUsername,
              MasterUserPassword: e.fineGrainedAccessControlMasterPassword,
            };
        }
        // TODO: Cognito
        await client.opensearchClient.createDomain(input);
        // wait for it to become available
        await this.waitForCreation(client.opensearchClient, e.domainName);
      }
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { domainName, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;
        const domain = (
          await client.opensearchClient.describeDomains({
            DomainNames: [domainName],
          })
        ).DomainStatusList?.pop();
        if (!domain) return undefined;
        return await this.domainMapper(domain, region, ctx);
      }
      const out: Domain[] = [];
      await Promise.all(
        enabledRegions.map(async region => {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const domainNames: string[] = [];
          (await client.opensearchClient.listDomainNames({})).DomainNames?.map((di: DomainInfo) =>
            domainNames.push(di.DomainName!),
          );
          if (!domainNames.length) return;

          const rawDomains =
            (await client.opensearchClient.describeDomains({ DomainNames: domainNames })).DomainStatusList ??
            [];
          for (const rawDomain of rawDomains) {
            const domain = await this.domainMapper(rawDomain, region, ctx);
            if (!!domain) out.push(domain);
          }
        }),
      );
      return out;
    },
    updateOrReplace: (prev: Domain, next: Domain) => 'update',
    update: async (es: Domain[], ctx: Context) => {
      return Promise.resolve(undefined);
    },
    delete: async (es: Domain[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await client.opensearchClient.deleteDomain({
          DomainName: e.domainName,
        });
      }
    },
  });

  constructor(module: AwsOpenSearchModule) {
    super();
    this.module = module;
    super.init();
  }
}
