import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm'
import { awsPrimaryKey } from '../services/aws-primary-key';

import { noDiff } from '../services/diff'
import { source, Source } from '../services/source-of-truth'

@source(Source.DB)
@Entity()
export class Cluster {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @awsPrimaryKey
  @Column({
    unique: true,
  })
  name: string;

  @Column({
    nullable: true,
  })
  arn?: string;

  @Column({
    nullable: true,
  })
  status?: string;

}
