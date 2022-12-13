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
} from './mappers';

export class AwsVpcModule extends ModuleBase {
  /** @internal */
  subnet: SubnetMapper;

  /** @internal */
  vpc: VpcMapper;

  /** @internal */
  natGateway: NatGatewayMapper;

  /** @internal */
  elasticIp: ElasticIpMapper;

  /** @internal */
  endpointGateway: EndpointGatewayMapper;

  /** @internal */
  endpointInterface: EndpointInterfaceMapper;

  /** @internal */
  availabilityZone: AvailabilityZoneMapper;

  /** @internal */
  routeTable: RouteTableMapper;

  /** @internal */
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
    this.routeTable = new RouteTableMapper(this);
    this.routeTableAssociation = new RouteTableAssociationMapper(this);
    super.init();
  }
}

export const awsVpcModule = new AwsVpcModule();
