import { ModuleBase } from '../../interfaces';
import {
  AvailabilityZoneMapper,
  ElasticIpMapper,
  EndpointGatewayMapper,
  NatGatewayMapper,
  SubnetMapper,
  VpcMapper,
} from './mappers';

export class AwsVpcModule extends ModuleBase {
  subnet: SubnetMapper;
  vpc: VpcMapper;
  natGateway: NatGatewayMapper;
  elasticIp: ElasticIpMapper;
  endpointGateway: EndpointGatewayMapper;
  availabilityZone: AvailabilityZoneMapper;

  constructor() {
    super();
    this.subnet = new SubnetMapper(this);
    this.vpc = new VpcMapper(this);
    this.natGateway = new NatGatewayMapper(this);
    this.elasticIp = new ElasticIpMapper(this);
    this.endpointGateway = new EndpointGatewayMapper(this);
    this.availabilityZone = new AvailabilityZoneMapper(this);
    super.init();
  }
}
export const awsVpcModule = new AwsVpcModule();
