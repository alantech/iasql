import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class ValidThreadsPerCore {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'int',
  })
  count: number;
}
