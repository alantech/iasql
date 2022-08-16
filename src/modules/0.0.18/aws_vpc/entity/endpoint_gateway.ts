import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { Vpc } from '.';
import { cloudId, } from '../../../../services/cloud-id'

export enum EndpointGatewayService {
  DYNAMODB = "dynamodb",
  S3 = "s3",
}

@Entity()
export class EndpointGateway {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, })
  @cloudId
  vpcEndpointId?: string;

  @Column({
    nullable: false,
    type: 'enum',
    enum: EndpointGatewayService,
  })
  service: EndpointGatewayService;

  @Column({ nullable: true, })
  policyDocument?: string;

  @ManyToOne(() => Vpc, { nullable: false, eager: true, })
  @JoinColumn({
    name: 'vpc_id',
  })
  vpc?: Vpc;

  @Column({ nullable: true, })
  state?: string;

  // TODO: update to be a reference to a RouteTable entity
  @Column("text", { nullable: true, array: true, })
  routeTableIds?: string[];

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };
}
