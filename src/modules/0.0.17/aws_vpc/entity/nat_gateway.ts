import { Check, Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { ElasticIp } from './elastic_ip';
import { Subnet } from './subnet';

// TODO: implement public ip path

export enum ConnectivityType {
  PRIVATE = 'private',
  PUBLIC = 'public',
}

export enum NatGatewayState {
  AVAILABLE = 'available',
  DELETED = 'deleted',
  DELETING = 'deleting',
  FAILED = 'failed',
  PENDING = 'pending',
}

@Check(
  'Check_elastic_ip_when_public',
  `("elastic_ip_id" is not null AND "connectivity_type" = 'public') OR "elastic_ip_id" is null`,
)
@Entity()
export class NatGateway {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  @cloudId
  natGatewayId?: string;

  @ManyToOne(() => Subnet, { nullable: false, eager: true })
  @JoinColumn({
    name: 'subnet_id',
  })
  subnet?: Subnet;

  @Column({
    type: 'enum',
    enum: ConnectivityType,
  })
  connectivityType: ConnectivityType;

  @OneToOne(() => ElasticIp, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({
    name: 'elastic_ip_id',
  })
  elasticIp?: ElasticIp;

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
}
