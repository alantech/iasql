import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  AfterLoad,
  AfterInsert,
  AfterUpdate,
  Unique,
  Check,
} from 'typeorm'

import { AliasTarget } from './alias_target';
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

@Unique('UQ_name__record_type', ['name', 'recordType'])
@Check('Check_record__alias_target', '("record" is null and "alias_target_id" is not null) or ("record" is not null and "alias_target_id" is null)')
@Check('Check_record__ttl', '("record" is null and "ttl" is null and "alias_target_id" is not null) or ("record" is not null and "ttl" is not null and "alias_target_id" is null)')
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

  @Column({ nullable: true, })
  record?: string;

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

  @ManyToOne(() => AliasTarget, {
    cascade: true,
    eager: true,
    nullable: true,
  })
  @JoinColumn({
    name: 'alias_target_id',
  })
  aliasTarget?: AliasTarget;
}
