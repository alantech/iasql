import { Column, Entity, Generated, Index } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

// @Index("subnet_group_name_region_idx", ["subnet_group_name", "region"], { unique: true })
@Entity()
export class SubnetGroup {
  @Column()
  @Generated('increment')
  id: number;

  @Column({ unique: true, primary: true })
  @cloudId
  subnetGroupName: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  arn?: string;

  @Column('varchar', { array: true, nullable: true })
  subnets?: string[];

  // This column is joined to `aws_regions` manually via hooks in the `../sql` directory
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  region: string;
}
