import { ModuleBase } from '../interfaces';
import { CertificateMapper } from './mappers';
import { CertificateRequestRpc, CertificateImportRpc } from './rpcs';

export class AwsAcmModule extends ModuleBase {
  /** @internal */
  certificate: CertificateMapper;
  certificateRequest: CertificateRequestRpc;
  certificateImport: CertificateImportRpc;

  constructor() {
    super();
    this.certificate = new CertificateMapper(this);
    this.certificateRequest = new CertificateRequestRpc(this);
    this.certificateImport = new CertificateImportRpc(this);
    super.init();
  }
}

/**
 *
 * ```testdoc
 * modules/aws-acm-list-integration.ts#AwsAcm List Integration Testing#Managing certificates
 * modules/aws-acm-import-integration.ts#AwsAcm Import Integration Testing#Importing a certificate
 * modules/aws-acm-request-integration.ts#AwsAcm Request Integration Testing#Requesting a certificate
 * ```
 */
export const awsAcmModule = new AwsAcmModule();
