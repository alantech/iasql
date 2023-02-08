import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage AWS availability zones. An Availability Zone (AZ) is one or more discrete data
 * centers with redundant power, networking, and connectivity in an AWS Region.
 *
 * This is a read-only table.
 *
 * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html
 */
@Unique('uq_az_region', ['name', 'region'])
@Entity({
  name: 'availability_zone',
})
export class AvailabilityZone {
  /**
   * @public
   * Name for the availability zone
   */
  @PrimaryColumn()
  @cloudId
  name: string;

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
