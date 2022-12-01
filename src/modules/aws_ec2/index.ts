import { ModuleBase } from '../interfaces';
import {
  GeneralPurposeVolumeMapper,
  InstanceMapper,
  KeyPairMapper,
  RegisteredInstanceMapper,
} from './mappers';
import { KeyPairImportRpc, KeyPairRequestRpc } from './rpcs';

export class AwsEc2Module extends ModuleBase {
  instance: InstanceMapper;
  registeredInstance: RegisteredInstanceMapper;
  generalPurposeVolume: GeneralPurposeVolumeMapper;
  keypair: KeyPairMapper;
  keyPairImport: KeyPairImportRpc;
  keyPairRequest: KeyPairRequestRpc;

  constructor() {
    super();
    this.instance = new InstanceMapper(this);
    this.registeredInstance = new RegisteredInstanceMapper(this);
    this.generalPurposeVolume = new GeneralPurposeVolumeMapper(this);
    this.keypair = new KeyPairMapper(this);
    this.keyPairImport = new KeyPairImportRpc(this);
    this.keyPairRequest = new KeyPairRequestRpc(this);
    super.init();
  }
}
export const awsEc2Module = new AwsEc2Module();
