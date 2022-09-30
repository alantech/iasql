import { ACM, CertificateDetail, paginateListCertificates } from '@aws-sdk/client-acm';

import { AWS, crudBuilderFormat, paginateBuilder, mapLin } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';
import {
  Certificate,
  certificateRenewalEligibilityEnum,
  certificateStatusEnum,
  certificateTypeEnum,
} from './entity';

class CertificateMapper extends MapperBase<Certificate> {
  module: AwsAcmListModule;
  entity = Certificate;
  entityId = (e: Certificate) => e.arn ?? e.id.toString();
  equals = (a: Certificate, b: Certificate) =>
    Object.is(a.certificateId, b.certificateId) &&
    Object.is(a.certificateType, b.certificateType) &&
    Object.is(a.domainName, b.domainName) &&
    Object.is(a.inUse, b.inUse) &&
    Object.is(a.renewalEligibility, b.renewalEligibility) &&
    Object.is(a.status, b.status);

  getCertificate = crudBuilderFormat<ACM, 'describeCertificate', CertificateDetail | undefined>(
    'describeCertificate',
    CertificateArn => ({ CertificateArn }),
    res => res?.Certificate,
  );
  getCertificatesSummary = paginateBuilder<ACM>(paginateListCertificates, 'CertificateSummaryList');
  getCertificates(client: ACM) {
    return mapLin(this.getCertificatesSummary(client), (cert: any) =>
      this.getCertificate(client, cert.CertificateArn),
    );
  }
  // TODO: How to macro-ify this function, or should the waiting bit be another macro function and
  // we compose two macro functions together?
  async deleteCertificate(client: ACM, arn: string) {
    await client.deleteCertificate({ CertificateArn: arn });
    let certificates: string[] = [];
    let i = 0;
    // Wait for ~1min until imported cert is available
    do {
      await new Promise(r => setTimeout(r, 2000)); // Sleep for 2s
      certificates = (await this.getCertificatesSummary(client))?.map(c => c.CertificateArn ?? '') ?? [];
      i++;
    } while (!certificates.includes(arn) && i < 30);
  }

  // Get Typescript to understand enum matching
  isCertType(t?: string): t is certificateTypeEnum {
    if (!t) return false;
    return Object.values<string>(certificateTypeEnum).includes(t);
  }
  isRenewalEligibility(t?: string): t is certificateRenewalEligibilityEnum {
    if (!t) return false;
    return Object.values<string>(certificateRenewalEligibilityEnum).includes(t);
  }
  isStatusType(t?: string): t is certificateStatusEnum {
    if (!t) return false;
    return Object.values<string>(certificateStatusEnum).includes(t);
  }
  certificateMapper(e: CertificateDetail) {
    const out = new Certificate();
    // To ignore faulty data in AWS, instead of throwing an error on bad data, we return
    // undefined
    if (!e?.CertificateArn) return undefined;
    out.arn = e.CertificateArn;
    out.certificateId = e.CertificateArn.split('/').pop();
    if (this.isCertType(e.Type)) out.certificateType = e.Type;
    if (!e.DomainName) return undefined;
    out.domainName = e.DomainName;
    out.inUse = !!e.InUseBy?.length;
    if (this.isRenewalEligibility(e.RenewalEligibility)) out.renewalEligibility = e.RenewalEligibility;
    if (this.isStatusType(e.Status)) out.status = e.Status;
    return out;
  }
  db = new Crud2<Certificate>({
    create: (es: Certificate[], ctx: Context) => ctx.orm.save(Certificate, es),
    update: (es: Certificate[], ctx: Context) => ctx.orm.save(Certificate, es),
    delete: (es: Certificate[], ctx: Context) => ctx.orm.remove(Certificate, es),
    read: async (ctx: Context, arn?: string) => {
      const opts = arn
        ? {
            where: {
              arn,
            },
          }
        : {};
      return await ctx.orm.find(Certificate, opts);
    },
  });
  cloud = new Crud2<Certificate>({
    create: async (es: Certificate[], ctx: Context) => {
      // Do not cloud create, just restore database
      await this.module.certificate.db.delete(es, ctx);
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawCert = await this.getCertificate(client.acmClient, id);
        if (!rawCert) return;
        return this.certificateMapper(rawCert);
      } else {
        const rawCerts = (await this.getCertificates(client.acmClient)) ?? [];
        const out = [];
        for (const rawCert of rawCerts) {
          const cert = this.certificateMapper(rawCert);
          if (cert) out.push(cert);
        }
        return out;
      }
    },
    updateOrReplace: () => 'update',
    update: async (es: Certificate[], ctx: Context) => {
      // Right now we can only modify AWS-generated fields in the database.
      // This implies that on `update`s we only have to restore the values for those records.
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.Certificate?.[e.arn ?? ''];
        cloudRecord.id = e.id;
        await this.module.certificate.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (es: Certificate[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        await this.deleteCertificate(client.acmClient, e.arn ?? '');
      }
    },
  });

  constructor(module: AwsAcmListModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsAcmListModule extends ModuleBase {
  certificate: CertificateMapper;

  constructor() {
    super();
    this.certificate = new CertificateMapper(this);
    super.init();
  }
}
export const awsAcmListModule = new AwsAcmListModule();
