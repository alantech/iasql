import { ModuleBase } from '../interfaces';
import {
  AvailabilityZoneMapper,
  ElasticIpMapper,
  EndpointGatewayMapper,
  EndpointInterfaceMapper,
  NatGatewayMapper,
  PeeringConnectionMapper,
  RouteTableAssociationMapper,
  RouteTableMapper,
  SubnetMapper,
  VpcMapper,
  InternetGatewayMapper,
  RouteMapper,
  DhcpOptionsMapper,
} from './mappers';

export class AwsVpcModule extends ModuleBase {
  /** @internal */
  subnet: SubnetMapper;

  /** @internal */
  dhcpOptions: DhcpOptionsMapper;

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
  peeringConnection: PeeringConnectionMapper;

  /** @internal */
  routeTable: RouteTableMapper;

  /** @internal */
  routeTableAssociation: RouteTableAssociationMapper;

  /** @internal */
  internetGateway: InternetGatewayMapper;

  /** @internal */
  networkAcl: NetworkAclMapper;

  /** @internal */
  route: RouteMapper;
  constructor() {
    super();
    // add modules in the right order
    this.availabilityZone = new AvailabilityZoneMapper(this);
    this.dhcpOptions = new DhcpOptionsMapper(this);
    this.vpc = new VpcMapper(this);
    this.subnet = new SubnetMapper(this);
    this.elasticIp = new ElasticIpMapper(this);

    this.routeTable = new RouteTableMapper(this);
    this.routeTableAssociation = new RouteTableAssociationMapper(this);
    this.route = new RouteMapper(this);
    this.natGateway = new NatGatewayMapper(this);
    this.endpointGateway = new EndpointGatewayMapper(this);
    this.endpointInterface = new EndpointInterfaceMapper(this);
    this.peeringConnection = new PeeringConnectionMapper(this);
    this.internetGateway = new InternetGatewayMapper(this);

    super.init();
  }
}

/**
 * ```testdoc
 * modules/aws-vpc-integration.ts#VPC Integration Testing#Manage VPCs
 * modules/aws-vpc-eip-nat-integration.ts#VPC Elastic IP Integration Testing#Manage Elastic IPs and NAT Gateways
 * modules/aws-vpc-endpoint-gateway-integration.ts#VPC Integration Testing#Manage Endpoint Gateways
 * modules/aws-vpc-endpoint-interface-integration.ts#VPC Endpoint interface Integration Testing#Manage Endpoint Interfaces
 * modules/aws-vpc-routetable-integration.ts#RouteTable Integration Testing#Manage Routing tables
 * ```
 */
export const awsVpcModule = new AwsVpcModule();
