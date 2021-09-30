import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

import { source, Source, } from '../services/source-of-truth'
import { awsPrimaryKey, } from '../services/aws-primary-key'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class ProductCode {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @awsPrimaryKey // TODO: What if it really is nullable?
  @Column({
    nullable: true
  })
  productCodeId?: string;

  @Column({
    nullable: true
  })
  productCodeType?: string;
}
