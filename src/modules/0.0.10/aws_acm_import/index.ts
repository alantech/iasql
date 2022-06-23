import { ImportCertificateCommandInput, paginateListCertificates, } from '@aws-sdk/client-acm'
import { AWS, paginateBuilder, } from '../../../services/aws_macros'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import { AwsAcmListModule } from '../aws_acm_list'
import { CertificateImport } from './entity'
import * as metadata from './module.json'

const getCertificatesSummary = paginateBuilder(paginateListCertificates, 'CertificateSummaryList');

// TODO: Can I macro this somehow?
async function importCertificate(client: any, input: ImportCertificateCommandInput) {
  const res = await client.importCertificate(input);
  const arn = res.CertificateArn ?? '';
  let certificates: string[] = [];
  let i = 0;
   // Wait for ~1min until imported cert is available
  do {
    const start = Date.now();
    await new Promise(r => setTimeout(r, 2000));
    while (Date.now() - start < 2000); // Sleep for 2s
    certificates = (await getCertificatesSummary(client))?.map(c => c.CertificateArn ?? '') ?? [];
    i++;
  } while (!certificates.includes(arn) && i < 30);
  return arn;
}

export const AwsAcmImportModule: Module2 = new Module2({
  ...metadata,
  mappers: {
    certificateImport: new Mapper2<CertificateImport>({
      entity: CertificateImport,
      entityId: (e: CertificateImport) => e.id?.toString() ?? '',
      equals: () => true, // only database values
      source: 'db',
      cloud: new Crud2({
        create: async (es: CertificateImport[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const textEncoder = new TextEncoder();
          for (const e of es) {
            const input: ImportCertificateCommandInput = {
              Certificate: textEncoder.encode(e.certificate),
              PrivateKey: textEncoder.encode(e.privateKey),
            };
            if (e.chain) {
              input.CertificateChain = textEncoder.encode(e.chain);
            }
            const importedCertArn = await importCertificate(client.acmClient, input);
            if (!importedCertArn) throw new Error('Error importing certificate');
            const importedCert = await AwsAcmListModule.mappers.certificate.cloud.read(ctx, importedCertArn);
            await AwsAcmImportModule.mappers.certificateImport.db.delete(e, ctx);
            try {
              await AwsAcmListModule.mappers.certificate.db.create(importedCert, ctx);
            } catch (e) {
              // Do nothing
              // AwsAcmListModule could not be installed and that's ok since there's no table dependency between them
            }
          }
        },
        read: async () => { return; },
        update: async () => { return; },
        delete: async () => { return; },
      }),
    }),
  },
}, __dirname);
