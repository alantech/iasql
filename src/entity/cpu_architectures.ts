import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class CPUArchitecture {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  cpuArchitecture: string;
}
