import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm'

@Entity()
export class EnvironmetVariable {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  value: string;
}
