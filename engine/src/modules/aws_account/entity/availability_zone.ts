import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AvailabilityZoneMessage, } from './availability_zone_message';
import { Region, } from './region';

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

@Entity()
export class AvailabilityZone {
  @PrimaryGeneratedColumn()
  id?: number;

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

  @OneToMany(
    () => AvailabilityZoneMessage,
    message => message.availabilityZone,
    { cascade: true, eager: true, })
  messages: AvailabilityZoneMessage[];

  @ManyToOne(() => Region, { eager: true, })
  @JoinColumn({
    name: 'region_id',
  })
  region: Region;

  @Column()
  zoneName: string;

  @Column()
  zoneId: string;

  @Column()
  groupName: string;

  @Column()
  networkBorderGroup: string;

  @ManyToOne(() => AvailabilityZone, {
    nullable: true,
  })
  @JoinColumn({
    name: 'parent_zone_id',
  })
  parentZone?: AvailabilityZone;
}
