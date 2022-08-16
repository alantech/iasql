import { ModuleBase, } from '../../interfaces'
import { GeneralPurposeVolumeMapper, InstanceMapper, RegisteredInstanceMapper, } from './mappers'

export class AwsEc2Module extends ModuleBase {
  instance: InstanceMapper;
  registeredInstance: RegisteredInstanceMapper;
  generalPurposeVolume: GeneralPurposeVolumeMapper;

  constructor() {
    super();
    this.instance = new InstanceMapper(this);
    this.registeredInstance = new RegisteredInstanceMapper(this);
    this.generalPurposeVolume = new GeneralPurposeVolumeMapper(this);
    super.init();
  }
}
export const awsEc2Module = new AwsEc2Module();