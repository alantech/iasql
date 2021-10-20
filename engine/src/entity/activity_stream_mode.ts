import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity()
export class ActivityStreamMode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  mode?: string;
}
