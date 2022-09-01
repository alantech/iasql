import {
  ACM,
  DescribeCertificateCommandInput,
  ImportCertificateCommandInput,
  paginateListCertificates,
  RecordType,
  RequestCertificateCommandInput,
} from '@aws-sdk/client-acm';

import { AWS, paginateBuilder } from '../../../services/aws_macros';
import { AwsAcmListModule } from '../../0.0.15';
import { AwsRoute53HostedZoneModule } from '../../0.0.16';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';
import { awsAcmListModule } from '../aws_acm_list';
import { awsRoute53HostedZoneModule } from '../aws_route53_hosted_zones';
import { ResourceRecordSet } from '../aws_route53_hosted_zones/entity';
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
        let validated = false;
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
        const cloudCert = await awsAcmListModule.certificate.db.create(requestedCert, ctx);

        // query the details of the certificate, to get the domain validation options
        if (e.validationMethod==ValidationMethod.DNS) {
          const input:DescribeCertificateCommandInput = {
            CertificateArn: requestedCertArn
          };
          const describedCert = await this.describeCertificate(client.acmClient, input);
          if (describedCert && describedCert.Certificate && describedCert.Certificate.DomainValidationOptions) {
            // we can proceed with validation
            for (const domainOption of describedCert.Certificate.DomainValidationOptions) {              
              if (domainOption.DomainName && domainOption.ValidationDomain) {
                // check for the id of the hosted zone
                const zoneId = await awsRoute53HostedZoneModule.resourceRecordSet.cloud.read(ctx, domainOption.DomainName);
                if (zoneId) {
                  // we need to create that in route 53
                  const record:ResourceRecordSet = {
                    name: domainOption.ValidationDomain,
                    parentHostedZone: zoneId,
                    recordType: RecordType.CNAME
                  }
                  const result = await awsRoute53HostedZoneModule.resourceRecordSet.cloud.create(record, ctx);

                  // now wait until the certificate has been validated
                  let i = 0;
                  do {
                    await new Promise(r => setTimeout(r, 2000)); // Sleep for 2s
                    const describedCert = await this.describeCertificate(client.acmClient, input);
                    if (describedCert.Certificate?.Status == 'VALIDATED') {
                      validated = true;
                    }
                    i++;
                  } while (i < 30);
        
                }
              }
            }
          }

          // if we are here, we could not validate the cert, remove it
          if (!validated) {
            if (cloudCert) {
              await awsAcmListModule.certificate.cloud.delete(cloudCert, ctx);
              await awsAcmListModule.certificate.db.delete(cloudCert, ctx);
            }
            throw new Error("Certificate could not be validated");
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
