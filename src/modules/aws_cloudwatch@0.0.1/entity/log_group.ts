import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm'

import { cloudId, } from '../../../services/cloud-id'

@Entity()
export class LogGroup {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
  })
  @cloudId
  logGroupName: string;

  @Column({
    nullable: true,
  })
  logGroupArn?: string;

  @Column({
    nullable: true,
    type: 'timestamp with time zone',
  })
  creationTime?: Date;

}
