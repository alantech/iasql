import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id';

@Entity()
export class SubnetGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, })
  @cloudId
  subnetGroupName: string;

  @Column({ nullable: true, })
  description?: string;

  @Column({ nullable: true, })
  arn?: string;
  
  @Column("varchar", { array: true, nullable: true, })
  subnets?: string[];
}
