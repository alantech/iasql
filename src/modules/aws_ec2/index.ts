import { ModuleBase } from '../interfaces';
import {
  GeneralPurposeVolumeMapper,
  InstanceMapper,
  KeyPairMapper,
  RegisteredInstanceMapper,
} from './mappers';
import { KeyPairImportRpc, KeyPairRequestRpc } from './rpcs';

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

  constructor() {
    super();
    // Mappers
    this.instance = new InstanceMapper(this);
    this.registeredInstance = new RegisteredInstanceMapper(this);
    this.generalPurposeVolume = new GeneralPurposeVolumeMapper(this);
    this.keypair = new KeyPairMapper(this);
    // RPCs
    this.keyPairImport = new KeyPairImportRpc(this);
    this.keyPairRequest = new KeyPairRequestRpc(this);
    super.init();
  }
}

/**
 * ### Code examples
 *
 * ```testdoc
 * modules/aws-ec2-integration.ts#EC2 Integration Testing#Manage EC2 instances
 * modules/aws-ec2-gpv-integration.ts#EC2 General Purpose Volume Integration Testing#Manage volumes
 * ```
 */
export const awsEc2Module = new AwsEc2Module();
