import { ACM, CertificateDetail, KeyAlgorithm, paginateListCertificates, Tag } from '@aws-sdk/client-acm';
import { ListCertificatesCommandInput } from '@aws-sdk/client-acm/dist-types/commands/ListCertificatesCommand';
import { parse as parseArn } from '@aws-sdk/util-arn-parser';

import { AwsAcmModule } from '..';
import {
  AWS,
  crudBuilder,
  crudBuilderFormat,
  eqTags,
  mapLin,
  paginateBuilder,
} from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import {
  Certificate,
  certificateRenewalEligibilityEnum,
  certificateStatusEnum,
  certificateTypeEnum,
} from '../entity';

export class CertificateMapper extends MapperBase<Certificate> {
  module: AwsAcmModule;
  entity = Certificate;
  entityId = (e: Certificate) => e.arn ?? e.id.toString();
  equals = (a: Certificate, b: Certificate) =>
    Object.is(a.certificateId, b.certificateId) &&
    Object.is(a.certificateType, b.certificateType) &&
    Object.is(a.domainName, b.domainName) &&
    Object.is(a.inUse, b.inUse) &&
    Object.is(a.renewalEligibility, b.renewalEligibility) &&
    Object.is(a.status, b.status) &&
    Object.is(a.region, b.region) &&
    eqTags(a.tags, b.tags);

  getCertificate = crudBuilderFormat<ACM, 'describeCertificate', CertificateDetail | undefined>(
    'describeCertificate',
    CertificateArn => ({ CertificateArn }),
    res => res?.Certificate,
  );
  getCertificatesSummary = paginateBuilder<ACM>(
    paginateListCertificates,
    'CertificateSummaryList',
    undefined,
    undefined,
    () =>
      ({
        Includes: {
          keyTypes: Object.keys(KeyAlgorithm),
        },
      } as ListCertificatesCommandInput),
  );

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

  getCertificateTags = crudBuilderFormat<ACM, 'listTagsForCertificate', Tag[] | undefined>(
    'listTagsForCertificate',
    CertificateArn => ({ CertificateArn }),
    res => res?.Tags,
  );

  createCertificateTags = crudBuilder<ACM, 'addTagsToCertificate'>(
    'addTagsToCertificate',
    (CertificateArn, Tags: Tag[]) => ({ CertificateArn, Tags }),
  );

  deleteCertificateTags = crudBuilder<ACM, 'removeTagsFromCertificate'>(
    'removeTagsFromCertificate',
    (CertificateArn, Tags: Tag[]) => ({ CertificateArn, Tags }),
  );

  certificateMapper(e: CertificateDetail, region: string, eTags: Tag[]) {
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
    out.region = region;
    if (eTags.length) {
      const tags: { [key: string]: string } = {};
      eTags
        .filter(t => !!t.Key && !!t.Value)
        .forEach(t => {
          tags[t.Key as string] = t.Value as string;
        });
      out.tags = tags;
    }
    return out;
  }

  db = new Crud<Certificate>({
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
  cloud = new Crud<Certificate>({
    create: async (es: Certificate[], ctx: Context) => {
      // Do not cloud create, just restore database
      await this.module.certificate.db.delete(es, ctx);
    },
    read: async (ctx: Context, arn?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!arn) {
        const region = parseArn(arn).region;
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawCert = await this.getCertificate(client.acmClient, arn);
          if (!rawCert) return;
          const rawTags = await this.getCertificateTags(client.acmClient, arn);
          return this.certificateMapper(rawCert, region, rawTags ?? []);
        }
      } else {
        const out: Certificate[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rawCerts = (await this.getCertificates(client.acmClient)) ?? [];
            for (const rawCert of rawCerts) {
              const rawTags = await this.getCertificateTags(client.acmClient, rawCert.CertificateArn);
              const cert = this.certificateMapper(rawCert, region, rawTags ?? []);
              if (cert) out.push(cert);
            }
          }),
        );
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
        if (!eqTags(cloudRecord.tags, e.tags)) {
          const client = (await ctx.getAwsClient(e.region)) as AWS;
          const tags = Object.entries(e.tags ?? {}).map(([k, v]) => ({ Key: k, Value: v }));
          const oldTags = Object.entries(cloudRecord.tags ?? {}).map(([k, v]) => ({ Key: k, Value: v }));
          if (oldTags.length) {
            await this.deleteCertificateTags(client.acmClient, cloudRecord.arn ?? '', oldTags);
          }
          if (tags.length) {
            await this.createCertificateTags(client.acmClient, cloudRecord.arn ?? '', tags);
          }
          // we want to save the old record, but the new tags
          cloudRecord.tags = e.tags;
        }
        await this.module.certificate.db.update(cloudRecord, ctx);
        out.push(cloudRecord);
      }
      return out;
    },
    delete: async (es: Certificate[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.deleteCertificate(client.acmClient, e.arn ?? '');
      }
    },
  });

  constructor(module: AwsAcmModule) {
    super();
    this.module = module;
    super.init();
  }
}
