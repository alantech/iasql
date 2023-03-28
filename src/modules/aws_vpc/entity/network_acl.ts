import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { NetworkAclEntry } from '@aws-sdk/client-ec2';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { Vpc } from './vpc';

@Unique('uq_acl_id_region', ['id', 'region'])
@Unique('uq_network_acl_id_region', ['networkAclId', 'region'])
@Entity()
export class NetworkAcl {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * AWS ID to identify the Network ACL
   */
  @Column({ nullable: true })
  @cloudId
  networkAclId?: string;

  /**
   * @public
   * Indicates whether this is the default network ACL for the VPC.
   */
  @Column({
    type: 'boolean',
    default: false,
  })
  isDefault: boolean;

  /**
   * @public
   * One or more entries (rules) in the network ACL.
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html#nacl-rules
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  entries?: NetworkAclEntry[];

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
   * Reference to the VPC associated to this endpoint
   */
  @ManyToOne(() => Vpc, { nullable: false, eager: true, onDelete: 'CASCADE', onUpdate: 'CASCADE' })
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
