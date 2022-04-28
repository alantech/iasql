import {
  Column,
  Entity,
  PrimaryColumn,
} from 'typeorm'
import { cloudId, } from 'iasql/services/cloud-id'

@Entity()
export class Cluster {
  @PrimaryColumn()
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
