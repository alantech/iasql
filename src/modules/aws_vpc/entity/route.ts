import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { RouteTable } from './route_table';

@Entity()
export class Route {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => RouteTable, {
    nullable: true, // shouldn't be, but orphanedRowAction doesn't work properly
  })
  @JoinColumn()
  routeTable: RouteTable;

  // destinations
  @Column({ nullable: true })
  DestinationCidrBlock?: string;

  @Column({ nullable: true })
  DestinationIpv6CidrBlock?: string;

  @Column({ nullable: true })
  DestinationPrefixListId?: string;

  // through
  @Column({ nullable: true })
  EgressOnlyInternetGatewayId?: string;

  @Column({ nullable: true })
  GatewayId?: string;

  @Column({ nullable: true })
  InstanceId?: string;

  @Column({ nullable: true })
  InstanceOwnerId?: string;

  @Column({ nullable: true })
  NatGatewayId?: string;

  @Column({ nullable: true })
  TransitGatewayId?: string;

  @Column({ nullable: true })
  LocalGatewayId?: string;

  @Column({ nullable: true })
  CarrierGatewayId?: string;

  @Column({ nullable: true })
  NetworkInterfaceId?: string;

  @Column({ nullable: true })
  VpcPeeringConnectionId?: string;

  @Column({ nullable: true })
  CoreNetworkArn?: string;
}
