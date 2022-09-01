import {
  ACM,
  ImportCertificateCommandInput,
  paginateListCertificates,
  RequestCertificateCommandInput,
} from '@aws-sdk/client-acm';

import { AWS, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';
import { awsAcmListModule } from '../aws_acm_list';
import { CertificateRequest } from './entity';

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
      const textEncoder = new TextEncoder();
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
