import { Entity, PrimaryGeneratedColumn, ManyToMany, JoinTable, } from 'typeorm';

import { PlacementGroupStrategy, } from './placement_group_strategy';

@Entity()
export class PlacementGroupInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => PlacementGroupStrategy, { cascade: true, })
  @JoinTable()
  supportedStrategies: PlacementGroupStrategy[];
}
