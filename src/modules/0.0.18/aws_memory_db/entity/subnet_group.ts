import {
  Column,
  Entity,
  Generated,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id';

@Entity()
export class SubnetGroup {
  @Column()
  @Generated('increment')
  id: number;

  @Column({ unique: true, primary: true, })
  @cloudId
  subnetGroupName: string;

  @Column({ nullable: true, })
  description?: string;

  @Column({ nullable: true, })
  arn?: string;

  @Column("varchar", { array: true, nullable: true, })
  subnets?: string[];
}
