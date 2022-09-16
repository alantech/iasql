import {
  ACM,
  CertificateDetail,
  CertificateStatus,
  DescribeCertificateCommandInput,
  DescribeCertificateCommandOutput,
  paginateListCertificates,
  RecordType,
  RequestCertificateCommandInput,
} from '@aws-sdk/client-acm';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AWS, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';
import { awsAcmListModule } from '../aws_acm_list';
import { awsRoute53HostedZoneModule } from '../aws_route53_hosted_zones';
import { HostedZone, ResourceRecordSet } from '../aws_route53_hosted_zones/entity';
import { CertificateRequest, ValidationMethod } from './entity';

class CertificateRequestMapper extends MapperBase<CertificateRequest> {
  module: AwsAcmRequestModule;
  entity = CertificateRequest;
  entityId = (e: CertificateRequest) => e.id?.toString() ?? '';
  equals = () => true; // only database values

  getCertificatesSummary = paginateBuilder<ACM>(paginateListCertificates, 'CertificateSummaryList');

  async requestCertificate(client: ACM, input: RequestCertificateCommandInput) {
    const res = await client.requestCertificate(input);
    const arn = res.CertificateArn ?? '';
    let certificates: string[] = [];
    let i = 0;
    // Wait for ~1min until imported cert is available
    do {
      await new Promise(r => setTimeout(r, 2000));
      certificates = (await this.getCertificatesSummary(client))?.map(c => c.CertificateArn ?? '') ?? [];
      i++;
    } while (!certificates.includes(arn) && i < 30);
    return arn;
  }

  async describeCertificate(client: ACM, input: DescribeCertificateCommandInput) {
    return await client.describeCertificate(input);
  }

  async certificateWaiter(
    client: ACM,
    arn: string,
    handleState: (vol: CertificateDetail | undefined) => { state: WaiterState },
  ) {
    return createWaiter<ACM, DescribeCertificateCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      {
        CertificateArn: arn,
      },
      async (cl, input) => {
        const data: DescribeCertificateCommandOutput = await cl.describeCertificate(input);
        try {
          return handleState(data.Certificate);
        } catch (e: any) {
          throw e;
        }
      },
    );
  }

  waitUntilIssued(client: ACM, arn: string) {
    return this.certificateWaiter(client, arn, (cert: CertificateDetail | undefined) => {
      // if not issued, retry
      if (!Object.is(cert?.Status, CertificateStatus.ISSUED)) {
        return { state: WaiterState.RETRY };
      }
      return { state: WaiterState.SUCCESS };
    });
  }

  async validateCertificate(client: ACM, ctx: Context, arn: string) {
    // first describe the certificate to retrieve the validation domains
    const input: DescribeCertificateCommandInput = {
      CertificateArn: arn,
    };

    // retry until we get the recordset field
    let i = 0;
    let canValidate = false;
    let describedCert: DescribeCertificateCommandOutput;
    do {
      await new Promise(r => setTimeout(r, 2000)); // Sleep for 2s
      describedCert = await this.describeCertificate(client, input);
      if (describedCert.Certificate?.DomainValidationOptions) {
        for (const option of describedCert.Certificate.DomainValidationOptions) {
          if (option.DomainName && option.ResourceRecord) {
            // we have the right values
            canValidate = true;
            break;
          }
        }
      }
      i++;
    } while (i < 30 && !canValidate);

    if (canValidate && describedCert.Certificate?.DomainValidationOptions) {
      // we can proceed with validation
      const createdRecordsets: ResourceRecordSet[] = [];
      for (const domainOption of describedCert.Certificate.DomainValidationOptions) {
        if (domainOption.DomainName && domainOption.ValidationDomain) {
          // check for the id of the hosted zone
          let parentZone: HostedZone | undefined;
          const zones: HostedZone[] | undefined = await awsRoute53HostedZoneModule.hostedZone.cloud.read(ctx);
          if (zones) {
            for (const zone of zones) {
              // if domain name ends with . remove it
              let domainToCheck = zone.domainName;
              if (domainToCheck.lastIndexOf('.') === domainToCheck.length - 1)
                domainToCheck = domainToCheck.substring(0, domainToCheck.length - 1);
              const parsedName = awsRoute53HostedZoneModule.resourceRecordSet.getNameFromDomain(
                domainOption.DomainName,
                domainToCheck,
              );
              if (parsedName) {
                parentZone = zone;
                break;
              }
            }
          }
          if (parentZone && domainOption.ResourceRecord?.Name) {
            try {
              // we need to create that in route 53
              const record: ResourceRecordSet = {
                name: domainOption.ResourceRecord?.Name,
                parentHostedZone: parentZone,
                record: domainOption.ResourceRecord.Value,
                ttl: 300,
                recordType: RecordType.CNAME,
              };
              const createdRecord = await awsRoute53HostedZoneModule.resourceRecordSet.cloud.create(
                record,
                ctx,
              );
              if (createdRecord) {
                createdRecordsets.push(record);
              }
            } catch (e) {
              throw new Error('Error creating hosted zone, could not validate');
            }
          }
        }
      }

      // if we have created at least one record, we try to check validation
      if (createdRecordsets.length > 0) await this.waitUntilIssued(client, arn);

      // now we need to remove all recordsets created
      await awsRoute53HostedZoneModule.resourceRecordSet.cloud.delete(createdRecordsets, ctx);
    }
  }

  db = new Crud2<CertificateRequest>({
    create: (es: CertificateRequest[], ctx: Context) => ctx.orm.save(CertificateRequest, es),
    update: (es: CertificateRequest[], ctx: Context) => ctx.orm.save(CertificateRequest, es),
    delete: (es: CertificateRequest[], ctx: Context) => ctx.orm.remove(CertificateRequest, es),
    read: async (ctx: Context, id?: string) => {
      const opts = id
        ? {
            where: {
              id,
            },
          }
        : {};
      return await ctx.orm.find(CertificateRequest, opts);
    },
  });
  cloud = new Crud2<CertificateRequest>({
    create: async (es: CertificateRequest[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        const input: RequestCertificateCommandInput = {
          CertificateAuthorityArn: e.arn,
          DomainName: e.domainName,
          DomainValidationOptions: e.domainValidationOptions,
          SubjectAlternativeNames: e.subjectAlternativeNames,
          ValidationMethod: e.validationMethod,
        };
        const requestedCertArn = await this.requestCertificate(client.acmClient, input);
        if (!requestedCertArn) throw new Error('Error requesting certificate');
        const requestedCert = await awsAcmListModule.certificate.cloud.read(ctx, requestedCertArn);
        await this.module.certificateRequest.db.delete(e, ctx);
        await awsAcmListModule.certificate.db.create(requestedCert, ctx);

        // query the details of the certificate, to get the domain validation options
        if (e.validationMethod === ValidationMethod.DNS) {
          const result = await this.validateCertificate(client.acmClient, ctx, requestedCertArn);
          // check if certificate has been validated
          const certInput: DescribeCertificateCommandInput = {
            CertificateArn: requestedCertArn,
          };
          const describedCert = await this.describeCertificate(client.acmClient, certInput);
          if (!(describedCert.Certificate?.Status === CertificateStatus.ISSUED)) {
            // not validated, need to remove it
            const cloudCert = await awsAcmListModule.certificate.cloud.read(ctx, requestedCertArn);
            if (cloudCert) {
              await awsAcmListModule.certificate.cloud.delete(cloudCert, ctx);
              await awsAcmListModule.certificate.db.delete(cloudCert, ctx);
            }
            throw new Error('Certificate could not be validated');
          }
        }
      }
    },
    read: async () => {
      return;
    },
    update: async () => {
      return;
    },
    delete: async () => {
      return;
    },
  });

  constructor(module: AwsAcmRequestModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsAcmRequestModule extends ModuleBase {
  certificateRequest: CertificateRequestMapper;

  constructor() {
    super();
    this.certificateRequest = new CertificateRequestMapper(this);
    super.init();
  }
}
export const awsAcmRequestModule = new AwsAcmRequestModule();
