import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { DnsRecordIpType } from '@aws-sdk/client-ec2';

import { Subnet, Vpc } from '.';
import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

export enum EndpointInterfaceService {
  DYNAMODB = 'dynamodb',
  S3 = 's3',
}

@Entity()
export class EndpointInterface {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  @cloudId
  vpcEndpointId?: string;

  @Column({
    nullable: false,
    type: 'enum',
    enum: EndpointInterfaceService,
  })
  service: EndpointInterfaceService;

  @Column({ nullable: true })
  policyDocument?: string;

  @ManyToOne(() => Vpc, { nullable: false, eager: true })
  @JoinColumn([
    {
      name: 'vpc_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  vpc?: Vpc;

  @Column({ nullable: true })
  state?: string;

  @ManyToMany(() => Subnet, { eager: true, nullable: true })
  @JoinTable({
    name: 'endpoint_interface_subnets',
  })
  subnets: Subnet[];

  @Column({
    type: 'boolean',
    nullable: true,
    default: true,
  })
  privateDnsEnabled: boolean;

  @Column({
    nullable: false,
    type: 'enum',
    enum: DnsRecordIpType,
  })
  dnsNameRecordType: DnsRecordIpType;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;
}
