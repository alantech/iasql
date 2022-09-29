import { Check, Column, Entity, Generated } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

@Entity()
@Check('check_subnet_group_subnets', 'check_subnet_group_subnets(subnets)')
@Check('check_subnet_group_subnets_same_vpc', 'check_subnet_group_subnets_same_vpc(subnets)')
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
}
