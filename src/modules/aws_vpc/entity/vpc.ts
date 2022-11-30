import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

export enum VpcState {
  AVAILABLE = 'available',
  PENDING = 'pending',
}

@Unique('uq_vpc_region', ['id', 'region'])
@Unique('uq_vpc_id_region', ['vpcId', 'region'])
@Entity()
export class Vpc {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  @cloudId
  vpcId?: string;

  @Column()
  cidrBlock: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: VpcState,
  })
  state?: VpcState;

  @Column({
    default: false,
  })
  isDefault: boolean;

  @Column({
    default: false,
  })
  enableDnsHostnames: boolean;

  @Column({
    default: false,
  })
  enableDnsSupport: boolean;

  @Column({
    default: false,
  })
  enableNetworkAddressUsageMetrics: boolean;

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
