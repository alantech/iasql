import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id'
import { Subnet } from './subnet';

export enum ConnectivityType {
  PRIVATE = "private",
  PUBLIC = "public"
}

export enum NatGatewayState {
  AVAILABLE = "available",
  DELETED = "deleted",
  DELETING = "deleting",
  FAILED = "failed",
  PENDING = "pending"
}

@Check('Check_elastic_ip_when_public', '("elastic_ip" is not null AND "connectivity_type" = "public") OR "elastic_ip" is not null')
@Entity()
export class NatGateway {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, })
  @cloudId
  natGatewayId?: string;

  @ManyToOne(() => Subnet, { nullable: false, eager: true, })
  @JoinColumn({
    name: 'subnet_id',
  })
  subnet?: Subnet;

  @Column({
    type: 'enum',
    enum: ConnectivityType,
  })
  connectivityType: ConnectivityType;

  @Column({ nullable: true, })
  elasticIp?: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: NatGatewayState,
  })
  state?: NatGatewayState;

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
