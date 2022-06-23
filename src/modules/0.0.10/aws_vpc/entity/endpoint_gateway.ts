import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { Vpc } from '.';
import { cloudId, } from '../../../../services/cloud-id'

export enum EndpointGatewayState {
  Available = "Available",
  Deleted = "Deleted",
  Deleting = "Deleting",
  Expired = "Expired",
  Failed = "Failed",
  Pending = "Pending",
  PendingAcceptance = "PendingAcceptance",
  Rejected = "Rejected"
}

export enum DnsRecordIpType {
  dualstack = "dualstack",
  ipv4 = "ipv4",
  ipv6 = "ipv6",
  service_defined = "service-defined"
}

export enum IpAddressType {
  dualstack = "dualstack",
  ipv4 = "ipv4",
  ipv6 = "ipv6"
}

// VpcEndpointType = 'Gateway'
@Entity()
export class EndpointGateway {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, })
  @cloudId
  vpcEndpointId?: string;


  @Column({ nullable: true, })
  serviceName: string;

  @Column({ nullable: true, })
  policyDocument?: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: DnsRecordIpType,
  })
  ipAddressType?: IpAddressType;

  @Column({
    nullable: true,
    type: 'enum',
    enum: DnsRecordIpType,
  })
  dnsRecordIpType?: DnsRecordIpType;

  @ManyToOne(() => Vpc, { nullable: false, eager: true, })
  @JoinColumn({
    name: 'vpc_id',
  })
  vpc?: Vpc;

  @Column({
    nullable: true,
    type: 'enum',
    enum: EndpointGatewayState,
  })
  state?: EndpointGatewayState;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

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
