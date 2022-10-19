import { ModuleBase } from '../../interfaces';
import { CertificateMapper } from './mappers';
import { CertificateRequestRpc, CertificateImportRpc } from './rpcs';

export class AwsAcmModule extends ModuleBase {
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

export const awsAcmModule = new AwsAcmModule();
