import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn, } from 'typeorm';

import { CPUArchitecture, } from './cpu_architecture';

@Entity()
export class ProcessorInfo {
  @PrimaryGeneratedColumn()
  id?: number;

  @ManyToMany(() => CPUArchitecture, { cascade: true, })
  @JoinTable()
  supportedArchitectures: CPUArchitecture[];

  @Column({
    type: 'decimal',
    nullable: true,
  })
  sustainedClockSpeedInGHz?: number;
}
