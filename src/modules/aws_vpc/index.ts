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
  peeringConnection: PeeringConnectionMapper;

  /** @internal */
  routeTable: RouteTableMapper;

  /** @internal */
  routeTableAssociation: RouteTableAssociationMapper;

  /** @internal */
  internetGateway: InternetGatewayMapper;

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
    this.internetGateway = new InternetGatewayMapper(this);
    super.init();
  }
}

/**
 * ## Code examples
 *
 * ### Create a VPC and a subnet within it
 *
 * Install the AWS virtual private cloud (VPC) module
 *
 * ```sql
 * SELECT * FROM iasql_install('aws_vpc');
 * ```
 *
 * Create an isolated VPC in which to create resources via the [`vpc`](https://dbdocs.io/iasql/iasql?table=vpc&schema=public&view=table_structure) table.
 * Read more about VPC [here](https://docs.aws.amazon.com/vpc/latest/userguide/configure-your-vpc.html).
 * To create a VPC, specify a range of IPv4 addresses for the VPC in the form of a Classless Inter-Domain Routing (CIDR) block.
 *
 * ```sql
 * INSERT INTO vpc (cidr_block)
 * VALUES ('192.168.0.0/16');
 * ```
 *
 * A VPC spans all the Availability Zones in an AWS Region. After you create a VPC, you can add one or more subnets in each Availability Zone.
 * The snippet below creates a non-default subnet in one of the availability zones within the newly created VPC
 *
 * ```sql TheButton[Create VPC subnet]="Run SQL"
 * INSERT INTO subnet (availability_zone, vpc_id, cidr_block)
 * SELECT (SELECT * FROM availability_zone LIMIT 1), id, '192.168.0.0/16'
 * FROM vpc WHERE is_default = false
 * AND cidr_block = '192.168.0.0/16';
 * ```
 */
export const awsVpcModule = new AwsVpcModule();
