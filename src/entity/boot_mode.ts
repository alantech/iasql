import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class BootMode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  mode: string;
}
