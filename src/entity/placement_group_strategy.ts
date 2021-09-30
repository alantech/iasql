import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

@Entity()
export class PlacementGroupStrategy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
  })
  strategy: string;
}
