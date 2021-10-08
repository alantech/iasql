import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class SupportedEngineMode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  mode: string;
}
