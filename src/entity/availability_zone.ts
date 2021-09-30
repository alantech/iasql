import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  ManyToMany,
} from 'typeorm';

import { AvailabilityZoneMessage, } from './availability_zone_message';
import { InstanceType, } from './instance_type';
import { Region, } from './region';
import { source, Source, } from '../services/source-of-truth'
import { awsPrimaryKey, } from '../services/aws-primary-key'
import { noDiff, } from '../services/diff'

export enum AvailabilityZoneState {
  AVAILABLE = 'available',
  IMPAIRED = 'impaired',
  INFORMATION = 'information',
  UNAVAILABLE = 'unavailable',
}

export enum AvailabilityZoneOptInStatus {
  NOT_OPTED_IN = 'not-opted-in',
  OPT_IN_NOT_REQUIRED = 'opt-in-not-required',
  OPTED_IN = 'opted-in',
}

@source(Source.AWS)
@Entity()
export class AvailabilityZone {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: AvailabilityZoneState,
    default: AvailabilityZoneState.AVAILABLE,
  })
  state: AvailabilityZoneState;

  @Column({
    type: 'enum',
    enum: AvailabilityZoneOptInStatus,
    default: AvailabilityZoneOptInStatus.OPT_IN_NOT_REQUIRED,
  })
  optInStatus: AvailabilityZoneOptInStatus;

  @OneToMany(() => AvailabilityZoneMessage, message => message.availabilityZone, { eager: true, })
  messages: AvailabilityZoneMessage[];

  @noDiff
  @ManyToOne(() => Region, { eager: true, })
  @JoinColumn({
    name: 'region_id',
  })
  region: Region;

  @Column()
  zoneName: string;

  @awsPrimaryKey
  @Column()
  zoneId: number;

  @Column()
  groupName: string;

  @Column()
  networkBorderGroup: string;

  @ManyToOne(() => AvailabilityZone, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({
    name: 'parent_zone_id',
  })
  parentZone: AvailabilityZone;

  @ManyToMany(() => InstanceType, { eager: true, })
  instanceTypes: InstanceType[];
}
