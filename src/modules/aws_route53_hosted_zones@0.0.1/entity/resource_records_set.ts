import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  AfterLoad,
  AfterInsert,
  AfterUpdate,
} from 'typeorm'

import { HostedZone } from './hosted_zone';

export enum RecordType {
  A = "A",
  AAAA = "AAAA",
  CAA = "CAA",
  CNAME = "CNAME",
  DS = "DS",
  MX = "MX",
  NAPTR = "NAPTR",
  NS = "NS",
  PTR = "PTR",
  SOA = "SOA",
  SPF = "SPF",
  SRV = "SRV",
  TXT = "TXT",
} 

// TODO add unique constraint based on name + record type + parenthostedzone
@Entity()
export class ResourceRecordSet {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: RecordType,
  })
  recordType: RecordType;

  @Column()
  records: string

  @Column({
    type: 'int',
    nullable: true,
  })
  ttl?: number;

  @ManyToOne(() => HostedZone, { eager: true, })
  @JoinColumn({
    name: 'parent_hosted_zone_id',
  })
  parentHostedZone: HostedZone;

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  updateNulls() {
    const that: any = this;
    Object.keys(this).forEach(k => {
      if (that[k] === null) that[k] = undefined;
    });
  }
}
