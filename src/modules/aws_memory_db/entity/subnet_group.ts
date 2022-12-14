import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage Memory DB subnet groups. A subnet group is a collection of subnets (typically private) that you can
 * designate for your clusters running in an Amazon Virtual Private Cloud (VPC) environment.
 * When you create a cluster in an Amazon VPC, you can specify a subnet group or use the default one provided.
 * MemoryDB uses that subnet group to choose a subnet and IP addresses within that subnet to associate with your nodes.
 *
 * @example
 * ```sql TheButton[Manage a MemoryDB subnet group]="Manage a MemoryDB subnet group"
 * INSERT INTO subnet_group (subnet_group_name) VALUES ('subnet_group');
 * SELECT * FROM subnet_group WHERE subnet_group_name = 'subnet_group';
 * DELETE FROM subnet_group WHERE subnet_group_name = 'subnet_group';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-memory-db-integration.ts#L109
 * @see https://docs.aws.amazon.com/memorydb/latest/devguide/subnetgroups.html
 */
@Entity()
@Unique('uq_subnet_group_id_region', ['id', 'region'])
@Unique('uq_subnet_group_name_region', ['subnetGroupName', 'region'])
export class SubnetGroup {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Name for the subnet group
   */
  @Column()
  @cloudId
  subnetGroupName: string;

  /**
   * @public
   * Description for the subnet group
   */
  @Column({ nullable: true })
  description?: string;

  /**
   * @public
   * AWS ARN for the subnet group
   */
  @Column({ nullable: true })
  arn?: string;

  /**
   * @public
   * List of subnets associated with the group
   */
  @Column('varchar', { array: true, nullable: true })
  subnets?: string[];

  /**
   * @public
   * Region for the subnet group
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
