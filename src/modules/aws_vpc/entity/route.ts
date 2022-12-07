import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { RouteTable } from './route_table';

@Entity()
export class Route {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => RouteTable, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn()
  routeTable: RouteTable;

  // destinations
  @Column({ nullable: true })
  @cloudId
  DestinationCidrBlock?: string;

  @Column({ nullable: true })
  @cloudId
  DestinationIpv6CidrBlock?: string;

  @Column({ nullable: true })
  @cloudId
  DestinationPrefixListId?: string;

  // through
  @Column({ nullable: true })
  @cloudId
  EgressOnlyInternetGatewayId?: string;

  @Column({ nullable: true })
  @cloudId
  GatewayId?: string;

  @Column({ nullable: true })
  @cloudId
  InstanceId?: string;

  @Column({ nullable: true })
  @cloudId
  InstanceOwnerId?: string;

  @Column({ nullable: true })
  @cloudId
  NatGatewayId?: string;

  @Column({ nullable: true })
  @cloudId
  TransitGatewayId?: string;

  @Column({ nullable: true })
  @cloudId
  LocalGatewayId?: string;

  @Column({ nullable: true })
  @cloudId
  CarrierGatewayId?: string;

  @Column({ nullable: true })
  @cloudId
  NetworkInterfaceId?: string;

  @Column({ nullable: true })
  @cloudId
  VpcPeeringConnectionId?: string;

  @Column({ nullable: true })
  @cloudId
  CoreNetworkArn?: string;
}
