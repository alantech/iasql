import { ACM, ImportCertificateCommandInput, paginateListCertificates } from '@aws-sdk/client-acm';

import { AwsAcmModule } from '..';
import { AWS, paginateBuilder } from '../../../services/aws_macros';
import { Context, RpcBase, RpcResponseObject } from '../../interfaces';
import { Certificate } from '../entity';
import { safeParse } from './common';

/**
 * Method for importing an AWS certificate, based on a local one.
 *
 * Returns following columns:
 *
 * arn: The unique ARN for the imported certificate
 *
 * status: OK if the certificate was imported successfully
 *
 * message: Error message in case of failure
 *
 * @example
 * ```sql
 *   SELECT * FROM certificate_import('***your_certificate_content***', '***your_key_content***', 'us-east-2', '');
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-acm-import-integration.ts#L86
 * @see https://aws.amazon.com/certificate-manager
 *
 */
export class CertificateImportRpc extends RpcBase {
  /**
   * @internal
   */
  module: AwsAcmModule;
  /**
   * @internal
   */
  outputTable = {
    arn: 'varchar',
    status: 'varchar',
    message: 'varchar',
  } as const;

  /**
   * @internal
   */
  getCertificatesSummary = paginateBuilder<ACM>(paginateListCertificates, 'CertificateSummaryList');

  /**
   *
   * Imports the certificate
   */
  // TODO: Can I macro this somehow?
  async importCertificate(client: ACM, input: ImportCertificateCommandInput) {
    const res = await client.importCertificate(input);
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

  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    certificate: string,
    privateKey: string,
    region: string,
    options: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    const opts = safeParse(options);
    const client = (await ctx.getAwsClient(region)) as AWS;
    const textEncoder = new TextEncoder();
    const input: ImportCertificateCommandInput = {
      Certificate: textEncoder.encode(certificate),
      PrivateKey: textEncoder.encode(privateKey),
    };
    if (opts?.chain) {
      input.CertificateChain = textEncoder.encode(opts.chain);
    }
    const importedCertArn = await this.importCertificate(client.acmClient, input);
    if (!importedCertArn) {
      return [
        {
          arn: '',
          status: 'ERROR',
          message: 'Error importing certificate',
        },
      ];
    }
    let importedCert: Certificate | undefined;
    try {
      importedCert = await this.module.certificate.cloud.read(ctx, importedCertArn);
      if (importedCert) await this.module.certificate.db.create(importedCert, ctx);
      if (!importedCert) throw new Error('Failure loading the certificate');
    } catch (e: any) {
      return [
        {
          arn: '',
          status: 'ERROR',
          message: e?.message ?? 'Failure loading the certificate',
        },
      ];
    }
    return [
      {
        arn: importedCertArn,
        status: importedCert?.status,
        message: 'Imported the certificate successfully',
      },
    ];
  };

  constructor(module: AwsAcmModule) {
    super();
    this.module = module;
    super.init();
  }
}
