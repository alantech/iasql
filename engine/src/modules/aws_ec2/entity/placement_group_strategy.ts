import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

@Entity()
export class PlacementGroupStrategy {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
  })
  strategy: string;
}
