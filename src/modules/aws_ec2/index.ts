import { ModuleBase } from '../interfaces';
import {
  GeneralPurposeVolumeMapper,
  InstanceMapper,
  KeyPairMapper,
  RegisteredInstanceMapper,
} from './mappers';
import { KeyPairImportRpc } from './rpcs';

export class AwsEc2Module extends ModuleBase {
  instance: InstanceMapper;
  registeredInstance: RegisteredInstanceMapper;
  generalPurposeVolume: GeneralPurposeVolumeMapper;
  keypair: KeyPairMapper;
  keyPairImport: KeyPairImportRpc;

  constructor() {
    super();
    this.instance = new InstanceMapper(this);
    this.registeredInstance = new RegisteredInstanceMapper(this);
    this.generalPurposeVolume = new GeneralPurposeVolumeMapper(this);
    this.keypair = new KeyPairMapper(this);
    this.keyPairImport = new KeyPairImportRpc(this);
    super.init();
  }
}
export const awsEc2Module = new AwsEc2Module();
