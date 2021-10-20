import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class CloudwatchLogsExport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  name: string;
}
