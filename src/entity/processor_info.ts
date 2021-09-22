import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';

import { CPUArchitecture, } from './cpu_architectures';

@Entity()
export class ProcessorInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => CPUArchitecture)
  @JoinTable()
  supportedArchitectures: CPUArchitecture[];

  @Column({
    type: 'decimal',
  })
  sustainedClockSpeedInGHz: number;
}
