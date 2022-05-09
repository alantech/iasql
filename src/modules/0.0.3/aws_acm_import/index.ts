import { ImportCertificateCommandInput } from '@aws-sdk/client-acm';
import { AWS, } from '../../../services/gateways/aws';
import { Context, Crud, Mapper, Module, } from '../../interfaces'
import { AwsAcmListModule } from '../aws_acm_list';
import { CertificateImport } from './entity';
import * as metadata from './module.json';


export const AwsAcmImportModule: Module = new Module({
  ...metadata,
  mappers: {
    certificateImport: new Mapper<CertificateImport>({
      entity: CertificateImport,
      entityId: (e: CertificateImport) => e.id?.toString() ?? '',
      equals: () => true, // only database values
      source: 'db',
      cloud: new Crud({
        create: async (es: CertificateImport[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const textEncoder = new TextEncoder();
          for (const e of es) {
            let input: ImportCertificateCommandInput = {
              Certificate: textEncoder.encode(e.body),
              PrivateKey: textEncoder.encode(e.privateKey),
            };
            if (e.chain) {
              input.CertificateChain = textEncoder.encode(e.chain);
            }
            const importedCertArn = await client.importCertificate(input);
            if (!importedCertArn) throw new Error('Error importing certificate');
            const importedCert = await AwsAcmListModule.mappers.certificate.cloud.read(ctx, importedCertArn);
            await AwsAcmImportModule.mappers.certificateImport.db.delete(e, ctx);
            await AwsAcmListModule.mappers.certificate.db.create(importedCert, ctx);
          }
        },
        read: async () => {},
        update: async () => {},
        delete: async () => {},
      }),
    }),
  },
}, __dirname);
