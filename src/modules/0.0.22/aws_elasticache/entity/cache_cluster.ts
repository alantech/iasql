import { Column, Entity, PrimaryColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';

export enum Engine {
  MEMCACHED = 'memcached',
  REDIS = 'redis',
}

@Entity()
export class CacheCluster {
  @PrimaryColumn({
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

  // This column is joined to `aws_regions` manually via hooks in the `../sql` directory
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  region: string;
}
