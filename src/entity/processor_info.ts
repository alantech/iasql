import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';

import { CPUArchitecture, } from './cpu_architecture';
import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class ProcessorInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => CPUArchitecture, { eager: true, })
  @JoinTable()
  supportedArchitectures: CPUArchitecture[];

  @Column({
    type: 'decimal',
    nullable: true,
  })
  sustainedClockSpeedInGHz?: number;
}
