import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm'

@Entity()
export class EngineVersion {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  engine: string;

  @Column()
  engineVersion: string;

  // Generated column to be able to index unique values
  @Column({
    unique: true,
  })
  engineVersionKey: string;
}