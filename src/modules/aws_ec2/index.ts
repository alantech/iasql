import { ModuleBase } from '../interfaces';
import {
  GeneralPurposeVolumeMapper,
  InstanceMapper,
  KeyPairMapper,
  RegisteredInstanceMapper,
} from './mappers';
import { InvokeRpc, KeyPairImportRpc, KeyPairRequestRpc } from './rpcs';

export class AwsEc2Module extends ModuleBase {
  /** @internal */
  instance: InstanceMapper;

  /** @internal */
  registeredInstance: RegisteredInstanceMapper;

  /** @internal */
  generalPurposeVolume: GeneralPurposeVolumeMapper;

  /** @internal */
  keypair: KeyPairMapper;

  keyPairImport: KeyPairImportRpc;
  keyPairRequest: KeyPairRequestRpc;
  invokeEc2: InvokeRpc;

  constructor() {
    super();
    this.instance = new InstanceMapper(this);
    this.registeredInstance = new RegisteredInstanceMapper(this);
    this.generalPurposeVolume = new GeneralPurposeVolumeMapper(this);
    this.keypair = new KeyPairMapper(this);
    this.keyPairImport = new KeyPairImportRpc(this);
    this.keyPairRequest = new KeyPairRequestRpc(this);
    this.invokeEc2 = new InvokeRpc(this);
    super.init();
  }
}

export const awsEc2Module = new AwsEc2Module();
