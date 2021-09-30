import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, } from 'typeorm';

import { AvailabilityZone, } from './availability_zone';
import { source, Source, } from '../services/source-of-truth'
import { awsPrimaryKey, } from '../services/aws-primary-key'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class AvailabilityZoneMessage {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @noDiff
  @ManyToOne(() => AvailabilityZone)
  @JoinColumn({
    name: 'availability_zone_id',
  })
  availabilityZone: AvailabilityZone;

  @awsPrimaryKey // TODO: What?
  @Column()
  message: string;
}
