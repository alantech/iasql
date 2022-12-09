import { ModuleBase } from '../interfaces';
import {
  AvailabilityZoneMapper,
  ElasticIpMapper,
  EndpointGatewayMapper,
  EndpointInterfaceMapper,
  NatGatewayMapper,
  RouteTableAssociationMapper,
  RouteTableMapper,
  SubnetMapper,
  VpcMapper,
  PeeringConnectionMapper,
} from './mappers';

export class AwsVpcModule extends ModuleBase {
  subnet: SubnetMapper;
  vpc: VpcMapper;
  natGateway: NatGatewayMapper;
  elasticIp: ElasticIpMapper;
  endpointGateway: EndpointGatewayMapper;
  endpointInterface: EndpointInterfaceMapper;
  availabilityZone: AvailabilityZoneMapper;
  peeringConnection: PeeringConnectionMapper;
  routeTable: RouteTableMapper;
  routeTableAssociation: RouteTableAssociationMapper;

  constructor() {
    super();
    this.subnet = new SubnetMapper(this);
    this.vpc = new VpcMapper(this);
    this.natGateway = new NatGatewayMapper(this);
    this.elasticIp = new ElasticIpMapper(this);
    this.endpointGateway = new EndpointGatewayMapper(this);
    this.endpointInterface = new EndpointInterfaceMapper(this);
    this.availabilityZone = new AvailabilityZoneMapper(this);
    this.peeringConnection = new PeeringConnectionMapper(this);
    this.routeTable = new RouteTableMapper(this);
    this.routeTableAssociation = new RouteTableAssociationMapper(this);
    super.init();
  }
}

export const awsVpcModule = new AwsVpcModule();
