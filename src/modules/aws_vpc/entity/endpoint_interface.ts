import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { DnsRecordIpType } from '@aws-sdk/client-ec2';

import { Subnet, Vpc } from '.';
import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * @enum
 * Available service types for the endpoint interface.
 */
export enum EndpointInterfaceService {
  S3 = 's3',
  S3_GLOBAL = 's3-global.accesspoint',
  API_GATEWAY = 'execute-api',
  RDS = 'rds',
  LOGS = 'logs',
  CODEBUILD = 'codebuild',
  CODEDEPLOY = 'codedeploy',
  CODEPIPELINE = 'codepipeline',
  EC2 = 'ec2',
  ECR = 'ecr',
  ECS = 'ecs',
  ELB = 'elasticloadbalancing',
  ELASTICACHE = 'elasticache',
  LAMBDA = 'lambda',
  MEMORYDB = 'memory-db',
}

/**
 * Table to manage AWS Interface endpoints, using PrivateLink.
 * AWS PrivateLink is a highly available, scalable technology that enables you to privately
 * connect your VPC to services as if they were in your VPC.
 *
 * @example
 * ```sql TheButton[Manage an Interface endpoint]="Manage an Interface endpoint"
 * INSERT INTO endpoint_interface (service, vpc_id, tags) SELECT 'lambda', id, '{"Name": "lambda_vpc_endpoint"}'
 * FROM vpc WHERE is_default = false AND cidr_block = '191.0.0.0/16';
 *
 * SELECT * FROM endpoint_interface WHERE tags ->> 'Name' = 'lambda_vpc_endpoint';
 *
 * DELETE FROM endpoint_interface WHERE tags ->> 'Name' = 'lambda_vpc_endpoint';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-vpc-integration.ts#L479
 * @see https://docs.aws.amazon.com/vpc/latest/privatelink/create-interface-endpoint.html
 */
@Entity()
export class EndpointInterface {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * AWS ID to identify the endpoint
   */
  @Column({ nullable: true })
  @cloudId
  vpcEndpointId?: string;

  /**
   * @public
   * Service type associated to this endpoint
   */
  @Column({
    nullable: false,
    type: 'enum',
    enum: EndpointInterfaceService,
  })
  service: EndpointInterfaceService;

  /**
   * @public
   * Complex type representing the policy associated to this endpoint
   * @see https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-access.html
   */
  @Column({ nullable: true })
  policyDocument?: string;

  /**
   * @public
   * Reference to the VPC associated to this endpoint
   */
  @ManyToOne(() => Vpc, { nullable: false, eager: true })
  @JoinColumn([
    {
      name: 'vpc_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  vpc?: Vpc;

  /**
   * @public
   * Current state for the endpoint
   * @see https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html
   */
  @Column({ nullable: true })
  state?: string;

  /**
   * @public
   * Reference to the subnets associated with this endpoint
   * @see https://docs.aws.amazon.com/vpc/latest/privatelink/interface-endpoints.html#add-remove-subnets
   */
  @ManyToMany(() => Subnet, { eager: true, nullable: true })
  @JoinTable({
    name: 'endpoint_interface_subnets',
  })
  subnets: Subnet[];

  /**
   * @public
   * Specifies if the endpoint is using private DNS resolution
   * @see https://docs.aws.amazon.com/vpc/latest/privatelink/manage-dns-names.html
   */
  @Column({
    type: 'boolean',
    nullable: true,
    default: false,
  })
  privateDnsEnabled: boolean;

  /**
   * @public
   * Type of DNS record to use for exposing the endpoint
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/enums/dnsrecordiptype.html
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: DnsRecordIpType,
    default: DnsRecordIpType.ipv4,
  })
  dnsNameRecordType: DnsRecordIpType;

  /**
   * @public
   * Complex type to provide identifier tags for the gateway
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

  /**
   * @public
   * Reference to the region where it belongs
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;
}
