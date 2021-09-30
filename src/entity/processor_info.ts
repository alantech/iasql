import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';

import { CPUArchitecture, } from './cpu_architecture';

@Entity()
export class ProcessorInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => CPUArchitecture)
  @JoinTable()
  supportedArchitectures: CPUArchitecture[];

  @Column({
    type: 'decimal',
    nullable: true,
  })
  sustainedClockSpeedInGHz?: number;
}
