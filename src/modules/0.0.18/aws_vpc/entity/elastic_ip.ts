import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id'

@Entity()
export class ElasticIp {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, })
  @cloudId
  allocationId?: string;

  @Column({ nullable: true, unique: true, })
  publicIp?: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };
}
