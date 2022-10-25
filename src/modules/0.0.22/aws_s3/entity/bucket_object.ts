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
@Unique('uq_bucketobject_bucket_name_key_region', ['bucketName', 'key', 'region'])
export class BucketObject {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  key: string;

  @Column({
    nullable: false,
    type: 'varchar',
  })
  @cloudId
  bucketName: string;

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
  region: string;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  eTag?: string;
}
