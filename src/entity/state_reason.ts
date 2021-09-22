import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class StateReason {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  code: string;

  @Column()
  message: string;
}
