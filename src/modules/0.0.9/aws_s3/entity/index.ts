import {
  Column,
  Entity,
  PrimaryColumn,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id'

@Entity()
export class Bucket {
  @PrimaryColumn({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  name: string;

  @Column({
    nullable: true,
    type: 'timestamp without time zone',
  })
  createdAt?: Date;
}

