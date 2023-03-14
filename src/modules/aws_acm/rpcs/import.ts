import { ACM, ImportCertificateCommandInput, paginateListCertificates } from '@aws-sdk/client-acm';

import { AwsAcmModule } from '..';
import { AWS, paginateBuilder } from '../../../services/aws_macros';
import { safeParse } from '../../../services/common';
import { Context, RpcBase, RpcInput, RpcResponseObject } from '../../interfaces';
import { Certificate } from '../entity';

/**
 * Method for importing an AWS certificate, based on a local one.
 *
 * Returns following columns:
 *
 * - arn: The unique ARN for the imported certificate
 *
 * - status: OK if the certificate was imported successfully
 *
 * - message: Error message in case of failure
 *
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
  inputTable: RpcInput = {
    certificate: 'varchar',
    privateKey: 'varchar',
    region: 'varchar',
    options: { argType: 'json', default: '{}' },
    tags: { argType: 'json', default: '{}' },
  };

  /**
   * @internal
   */
  getCertificatesSummary = paginateBuilder<ACM>(paginateListCertificates, 'CertificateSummaryList');

  /**
   *
   * Imports the certificate
   *
   * @privateRemarks
   * TODO: Can I macro this somehow?
   */
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
    tags: string,
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
    const transformedTags = Object.entries(safeParse(tags))?.map(([k, v]) => ({ Key: k, Value: v })) ?? [];
    if (transformedTags.length) {
      await this.module.certificate.createCertificateTags(client.acmClient, importedCertArn, transformedTags);
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
