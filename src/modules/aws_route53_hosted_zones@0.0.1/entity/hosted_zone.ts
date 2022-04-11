import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm'

import { cloudId, } from '../../../services/cloud-id'
import { ResourceRecordSet } from './resource_records_set';

@Entity()
export class HostedZone {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
    nullable: true,
  })
  @cloudId
  hostedZoneId: string;

  @Column()
  domainName: string;

  @OneToMany(() => ResourceRecordSet, r => r.parentHostedZone)
  records: ResourceRecordSet[];
}
