import { ACM, ImportCertificateCommandInput, paginateListCertificates, } from '@aws-sdk/client-acm'
import { AWS, paginateBuilder, } from '../../../services/aws_macros'
import { Context, Crud2, MapperBase, ModuleBase, } from '../../interfaces'
import { awsAcmListModule } from '../aws_acm_list'
import { CertificateImport } from './entity'
import * as metadata from './module.json'

class CertificateImportMapper extends MapperBase<CertificateImport> {
  module: AwsAcmImportModule;
  entity = CertificateImport;
  entityId = (e: CertificateImport) => e.id?.toString() ?? '';
  equals = () => true; // only database values

  getCertificatesSummary = paginateBuilder<ACM>(paginateListCertificates, 'CertificateSummaryList');

  // TODO: Can I macro this somehow?
  async importCertificate(client: ACM, input: ImportCertificateCommandInput) {
    const res = await client.importCertificate(input);
    const arn = res.CertificateArn ?? '';
    let certificates: string[] = [];
    let i = 0;
     // Wait for ~1min until imported cert is available
    do {
      await new Promise(r => setTimeout(r, 2000));
      certificates = (await this.getCertificatesSummary(client))
        ?.map(c => c.CertificateArn ?? '') ?? [];
      i++;
    } while (!certificates.includes(arn) && i < 30);
    return arn;
  }

  db = new Crud2<CertificateImport>({
    create: (es: CertificateImport[], ctx: Context) => ctx.orm.save(this.entity, es),
    update: (es: CertificateImport[], ctx: Context) => ctx.orm.save(this.entity, es),
    delete: (es: CertificateImport[], ctx: Context) => ctx.orm.remove(this.entity, es),
    read: async (ctx: Context, id?: string) => {
      const opts = id ? {
        where: {
          id,
        }
      } : {};
      return await ctx.orm.find(this.entity, opts);
    },
  });
  cloud = new Crud2<CertificateImport>({
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
        const importedCertArn = await this.importCertificate(client.acmClient, input);
        if (!importedCertArn) throw new Error('Error importing certificate');
        const importedCert = await awsAcmListModule.certificate.cloud.read(ctx, importedCertArn);
        await this.module.certificateImport.db.delete(e, ctx);
        try {
          await awsAcmListModule.certificate.db.create(importedCert, ctx);
        } catch (e) {
          // Do nothing
          // AwsAcmListModule could not be installed and that's ok since there's no table dependency between them
        }
      }
    },
    read: async () => { return; },
    update: async () => { return; },
    delete: async () => { return; },
  });

  constructor(module: AwsAcmImportModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsAcmImportModule extends ModuleBase {
  dependencies = metadata.dependencies;
  certificateImport: CertificateImportMapper;

  constructor() {
    super();
    this.certificateImport = new CertificateImportMapper(this);
    super.init();
  }
}
export const awsAcmImportModule = new AwsAcmImportModule();
