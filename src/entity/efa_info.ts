import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class EFAInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'int',
  })
  maximumEFAInterfaces: number;
}
