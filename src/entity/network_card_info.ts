import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class NetworkCardInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'int',
  })
  networkCardIndex: number;

  @Column()
  networkPerformance: string;

  @Column({
    type: 'int',
  })
  maximumNetworkInterfaces: number;
}
