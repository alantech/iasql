import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

export enum Engine {
  MEMCACHED = 'memcached',
  REDIS = 'redis',
}

@Entity()
export class CacheCluster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  clusterId: string;

  // TODO: convert it to an independent table in the future
  @Column({
    nullable: true,
  })
  nodeType: string;

  @Column({
    type: 'enum',
    enum: Engine,
    default: Engine.REDIS,
  })
  engine: Engine;

  @Column({
    nullable: true,
  })
  numNodes?: number;

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
