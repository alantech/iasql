import { AwsSdkInvoker, ModuleBase } from '../interfaces';
import { CertificateMapper } from './mappers';
import { CertificateRequestRpc, CertificateImportRpc } from './rpcs';

export class AwsAcmModule extends ModuleBase {
  /** @internal */
  certificate: CertificateMapper;
  certificateRequest: CertificateRequestRpc;
  certificateImport: CertificateImportRpc;
  invokeAcm: AwsSdkInvoker;

  constructor() {
    super();
    this.certificate = new CertificateMapper(this);
    this.certificateRequest = new CertificateRequestRpc(this);
    this.certificateImport = new CertificateImportRpc(this);
    this.invokeAcm = new AwsSdkInvoker('acmClient', this);
    super.init();
  }
}

export const awsAcmModule = new AwsAcmModule();
