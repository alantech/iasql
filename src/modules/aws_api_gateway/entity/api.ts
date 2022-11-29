import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

export enum Protocol {
  HTTP = 'HTTP',
  WEBSOCKET = 'WEBSOCKET',
}

@Entity()
export class Api {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true,
  })
  @cloudId
  apiId: string;

  @Column({
    nullable: true,
  })
  name?: string;

  @Column({
    nullable: true,
  })
  description?: string;

  @Column({
    nullable: true,
  })
  disableExecuteApiEndpoint?: boolean;

  @Column({
    type: 'enum',
    enum: Protocol,
    nullable: true,
  })
  protocolType?: Protocol;

  @Column({
    nullable: true,
  })
  version?: string;

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
