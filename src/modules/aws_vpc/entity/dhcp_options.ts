import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage AWS DHCP options sets.
 * DHCP option sets give you control over the following aspects of routing in your virtual network
 *
 * @see https://docs.aws.amazon.com/vpc/latest/userguide/VPC_DHCP_Options.html
 */
@Entity()
export class DhcpOptions {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * AWS ID to identify the DHCP option set
   */
  @Column({ nullable: true })
  @cloudId
  dhcpOptionsId?: string;

  /**
   * @public
   * List of DHCP configuration options
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  dhcpConfigurations?: {
    Key: string;
    Values: string[];
  }[];

  /**
   * @public
   * Complex type to provide identifier tags for the instance
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/tag.html
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
