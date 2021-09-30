import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class ValidCore {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'int',
  })
  count: number;
}
