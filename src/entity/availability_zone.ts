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

  @OneToMany(() => AvailabilityZoneMessage, message => message.availabilityZone)
  messages: AvailabilityZoneMessage[];

  @ManyToOne(() => Region)
  @JoinColumn({
    name: 'region_id',
  })
  region: Region;

  @Column()
  zoneName: string;

  @Column()
  zoneId: number;

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
  parentZone: AvailabilityZone;

  @ManyToMany(() => InstanceType)
  instanceTypes: InstanceType[];
}
