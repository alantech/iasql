import { Entity, PrimaryGeneratedColumn, ManyToMany, JoinTable, } from 'typeorm';

import { PlacementGroupStrategy, } from './placement_group_strategy';

@Entity()
export class PlacementGroupInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => PlacementGroupStrategy)
  @JoinTable()
  supportedStrategies: PlacementGroupStrategy[];
}
