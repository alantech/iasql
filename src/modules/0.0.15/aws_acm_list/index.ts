import { ACM, CertificateDetail, paginateListCertificates } from '@aws-sdk/client-acm';

import { AWS, crudBuilderFormat, paginateBuilder, mapLin } from '../../../services/aws_macros';
import { Context, Crud2, Mapper2, Module2 } from '../../interfaces';
import { Certificate, certificateRenewalEligibilityEnum, certificateStatusEnum, certificateTypeEnum } from './entity';
import * as metadata from './module.json';

const getCertificate = crudBuilderFormat<ACM, 'describeCertificate', CertificateDetail | undefined>(
  'describeCertificate',
  CertificateArn => ({ CertificateArn }),
  res => res?.Certificate,
);
const getCertificatesSummary = paginateBuilder<ACM>(paginateListCertificates, 'CertificateSummaryList');
const getCertificates = (client: ACM) =>
  mapLin(getCertificatesSummary(client), (cert: any) => getCertificate(client, cert.CertificateArn));
// TODO: How to macro-ify this function, or should the waiting bit be another macro function and we
// compose two macro functions together?
async function deleteCertificate(client: ACM, arn: string) {
  await client.deleteCertificate({ CertificateArn: arn });
  let certificates: string[] = [];
  let i = 0;
  // Wait for ~1min until imported cert is available
  do {
    await new Promise(r => setTimeout(r, 2000)); // Sleep for 2s
    certificates = (await getCertificatesSummary(client))?.map(c => c.CertificateArn ?? '') ?? [];
    i++;
  } while (!certificates.includes(arn) && i < 30);
}

// Get Typescript to understand enum matching
const isCertType = (t?: string): t is certificateTypeEnum => {
  if (!t) return false;
  return Object.values<string>(certificateTypeEnum).includes(t);
};
const isRenewalEligibility = (t?: string): t is certificateRenewalEligibilityEnum => {
  if (!t) return false;
  return Object.values<string>(certificateRenewalEligibilityEnum).includes(t);
};
const isStatusType = (t?: string): t is certificateStatusEnum => {
  if (!t) return false;
  return Object.values<string>(certificateStatusEnum).includes(t);
};

export const AwsAcmListModule: Module2 = new Module2(
  {
    ...metadata,
    utils: {
      certificateMapper: (e: CertificateDetail) => {
        const out = new Certificate();
        // To ignore faulty data in AWS, instead of throwing an error on bad data, we return
        // undefined
        if (!e?.CertificateArn) return undefined;
        out.arn = e.CertificateArn;
        out.certificateId = e.CertificateArn.split('/').pop();
        if (isCertType(e.Type)) out.certificateType = e.Type;
        if (!e.DomainName) return undefined;
        out.domainName = e.DomainName;
        out.inUse = !!e.InUseBy?.length;
        if (isRenewalEligibility(e.RenewalEligibility)) out.renewalEligibility = e.RenewalEligibility;
        if (isStatusType(e.Status)) out.status = e.Status;
        return out;
      },
    },
    mappers: {
      certificate: new Mapper2<Certificate>({
        entity: Certificate,
        entityId: (e: Certificate) => e.arn ?? e.id.toString(),
        equals: (a: Certificate, b: Certificate) =>
          Object.is(a.certificateId, b.certificateId) &&
          Object.is(a.certificateType, b.certificateType) &&
          Object.is(a.domainName, b.domainName) &&
          Object.is(a.inUse, b.inUse) &&
          Object.is(a.renewalEligibility, b.renewalEligibility) &&
          Object.is(a.status, b.status),
        source: 'db',
        cloud: new Crud2({
          create: async (es: Certificate[], ctx: Context) => {
            // Do not cloud create, just restore database
            await AwsAcmListModule.mappers.certificate.db.delete(es, ctx);
          },
          read: async (ctx: Context, id?: string) => {
            const client = (await ctx.getAwsClient()) as AWS;
            if (id) {
              const rawCert = await getCertificate(client.acmClient, id);
              if (!rawCert) return;
              return AwsAcmListModule.utils.certificateMapper(rawCert);
            } else {
              const out = (await getCertificates(client.acmClient)) ?? [];
              return out.map(AwsAcmListModule.utils.certificateMapper);
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
              await AwsAcmListModule.mappers.certificate.db.update(cloudRecord, ctx);
              out.push(cloudRecord);
            }
            return out;
          },
          delete: async (es: Certificate[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const e of es) {
              await deleteCertificate(client.acmClient, e.arn ?? '');
            }
          },
        }),
      }),
    },
  },
  __dirname,
);
