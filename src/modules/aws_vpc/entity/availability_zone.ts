import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage AWS availability zones. This is a read-only table.
 *
 * @example
 * ```sql
 * SELECT * FROM availability_zone;
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-vpc-integration.ts#L112
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
