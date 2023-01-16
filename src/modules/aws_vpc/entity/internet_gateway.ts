import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { AttachmentStatus } from '@aws-sdk/client-ec2/dist-types/models/models_0';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { Route } from './route';
import { RouteTableAssociation } from './route_table_association';
import { Vpc } from './vpc';

/**
 * Table to manage AWS Internet Gateway.
 * An internet gateway is a horizontally scaled, redundant, and highly available VPC component that enables communication between your VPC and the internet.
 *
 * @example
 * ```sql TheButton[Creates a Route table]="Creates a Route table"
 * INSERT INTO internet_gateway (tags, region) VALUES
 * ('{"name":"internet_gateway"}', 'us-east-1');
 * ```
 *
 * @see https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html
 */
@Entity()
export class InternetGateway {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * AWS-generated id for this internet gateway
   */
  @Column({ nullable: true })
  @cloudId
  internetGatewayId?: string;

  /**
   * @public
   * Reference to the VPC associated with this internet gateway
   */
  @ManyToOne(() => Vpc, {
    nullable: true,
    eager: true,
    onDelete: 'CASCADE',
  })
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
   * Complex type to provide identifier tags for the internet gateway
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
