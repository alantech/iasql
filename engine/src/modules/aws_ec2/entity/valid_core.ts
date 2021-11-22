import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

@Entity()
export class ValidCore {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    type: 'int',
  })
  count: number;
}
