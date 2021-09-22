import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class ProductCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  code: string;
}
