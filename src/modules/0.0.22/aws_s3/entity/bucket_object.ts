import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { Bucket } from './bucket';

@Entity()
@Unique('uq_bucketobject_id_region', ['id', 'region'])
@Unique('uq_bucketobject_bucket_key_region', ['key', 'region'])
export class BucketObject {
  @PrimaryGeneratedColumn()
  id: number;

  @PrimaryColumn({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  key: string;

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
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  bucket?: Bucket;

  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;

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
}
