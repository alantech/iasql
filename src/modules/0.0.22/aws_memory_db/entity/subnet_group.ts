import {
  Check,
  Column,
  Entity,
  Generated,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

@Entity()
@Check('check_subnet_group_subnets', 'check_subnet_group_subnets(subnets)')
@Check('check_subnet_group_subnets_same_vpc', 'check_subnet_group_subnets_same_vpc(subnets)')
@Unique('uq_subnet_group_id_region', ['id', 'region'])
@Unique('uq_subnet_group_name_region', ['subnetGroupName', 'region'])
export class SubnetGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @cloudId
  subnetGroupName: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  arn?: string;

  @Column('varchar', { array: true, nullable: true })
  subnets?: string[];

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
