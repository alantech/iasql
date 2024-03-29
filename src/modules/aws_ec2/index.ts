import { ModuleBase } from '../interfaces';
import {
  GeneralPurposeVolumeMapper,
  InstanceBlockDeviceMappingMapper,
  InstanceMapper,
  KeyPairMapper,
  RegisteredInstanceMapper,
} from './mappers';
import { DescribeAmiRpc, KeyPairImportRpc, KeyPairRequestRpc } from './rpcs';

export class AwsEc2Module extends ModuleBase {
  /** @internal */
  instance: InstanceMapper;

  /** @internal */
  registeredInstance: RegisteredInstanceMapper;

  /** @internal */
  generalPurposeVolume: GeneralPurposeVolumeMapper;

  /** @internal */
  instanceBlockDeviceMapping: InstanceBlockDeviceMappingMapper;

  /** @internal */
  keypair: KeyPairMapper;

  keyPairImport: KeyPairImportRpc;
  keyPairRequest: KeyPairRequestRpc;
  describeAmi: DescribeAmiRpc;

  constructor() {
    super();
    // Mappers
    this.instance = new InstanceMapper(this);
    this.registeredInstance = new RegisteredInstanceMapper(this);
    this.generalPurposeVolume = new GeneralPurposeVolumeMapper(this);
    this.instanceBlockDeviceMapping = new InstanceBlockDeviceMappingMapper(this);
    this.keypair = new KeyPairMapper(this);
    // RPCs
    this.keyPairImport = new KeyPairImportRpc(this);
    this.keyPairRequest = new KeyPairRequestRpc(this);
    this.describeAmi = new DescribeAmiRpc(this);
    super.init();
  }
}

/**
 * ```testdoc
 * modules/aws-ec2-integration.ts#EC2 Integration Testing#Manage EC2 instances
 * modules/aws-ec2-multi-region.ts#EC2 Integration Testing#Move instance from region
 * modules/aws-ec2-gpv-integration.ts#EC2 General Purpose Volume Integration Testing#Manage volumes
 * ```
 */
export const awsEc2Module = new AwsEc2Module();
