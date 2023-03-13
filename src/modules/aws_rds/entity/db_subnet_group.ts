import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { Subnet } from '@aws-sdk/client-rds';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { Vpc } from '../../aws_vpc/entity';

/**
 * Table to manage AWS RDS subnet groups. DB subnet groups must contain at least one subnet in at
 * least two AZs in the Amazon Web Services Region.
 *
 * @see https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html
 */
@Entity()
@Unique('db_subnet_group_name_region', ['name', 'region'])
@Unique('db_subnet_group_id_region', ['id', 'region']) // So the RDS entity can join on both
export class DBSubnetGroup {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Name for the subnet group
   */
  @cloudId
  @Column()
  name: string;

  /**
   * @public
   * AWS ARN for the subnet group
   */
  @Column({
    unique: true,
    nullable: true,
  })
  arn?: string;

  /**
   * @public
   * Description for the subnet group
   */
  @Column()
  description: string;

  /**
   * @public
   * List of subnets associated with the group
   */
  @Column('varchar', { array: true, nullable: true })
  subnets?: string[];

  /**
   * @public
   * Region for the instance
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
