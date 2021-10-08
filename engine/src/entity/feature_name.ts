import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class FeatureName {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  name: string;
}
