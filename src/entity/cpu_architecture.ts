import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

import { source, Source, } from '../services/source-of-truth'
import { awsPrimaryKey, } from '../services/aws-primary-key'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class CPUArchitecture {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @awsPrimaryKey
  @Column({
    unique: true,
  })
  cpuArchitecture: string;
}
