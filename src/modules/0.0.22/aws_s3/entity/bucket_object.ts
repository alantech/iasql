import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { Bucket } from './bucket';

@Entity()
export class BucketObject {
  @PrimaryColumn({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  key: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  eTag?: string;

  @Column({
    nullable: true,
    type: 'timestamp without time zone',
  })
  lastModified?: Date;

  @Column({
    type: 'integer',
    nullable: true,
  })
  size?: number;

  @cloudId
  @ManyToOne(() => Bucket, bucket => Bucket.name, {
    eager: true,
    nullable: true,
  })
  @JoinColumn([
    {
      name: 'bucket_name',
      referencedColumnName: 'name',
    },
  ])
  bucket?: Bucket;
}
