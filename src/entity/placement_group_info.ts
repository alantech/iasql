import { Entity, PrimaryGeneratedColumn, ManyToMany, JoinTable, } from 'typeorm';

import { PlacementGroupStrategy, } from './placement_group_strategy';
import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class PlacementGroupInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => PlacementGroupStrategy, { eager: true, })
  @JoinTable()
  supportedStrategies: PlacementGroupStrategy[];
}
