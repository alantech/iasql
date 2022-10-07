import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

// This is ridiculous. Can we fix this?

@Unique('uq_az_region', ['name', 'region'])
@Entity({
  name: 'availability_zone',
})
export class AvailabilityZone {
  @PrimaryColumn()
  @cloudId
  name: string;

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
