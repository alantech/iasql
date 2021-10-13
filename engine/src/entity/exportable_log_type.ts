import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class ExportableLogType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  name: string;
}
