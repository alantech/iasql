import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class DBInstanceClass {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  name: string;
}
