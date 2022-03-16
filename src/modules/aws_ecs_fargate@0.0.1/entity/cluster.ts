import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { cloudId, } from '../../../services/cloud-id'

@Entity()
export class Cluster {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
  })
  clusterName: string;

  @Column({
    nullable: true,
  })
  @cloudId
  clusterArn?: string;

  @Column({
    nullable: true,
  })
  clusterStatus?: string;

}
