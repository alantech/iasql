import { Entity, Column, OneToMany, PrimaryGeneratedColumn, Unique, ManyToOne, JoinColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { RepositoryImage } from './repository_image';

export enum ImageTagMutability {
  IMMUTABLE = 'IMMUTABLE',
  MUTABLE = 'MUTABLE',
}

@Entity()
@Unique('uq_repository_id_region', ['id', 'region'])
@Unique('uq_repository_name_region', ['repositoryName', 'region'])
export class Repository {
  @PrimaryGeneratedColumn()
  id: number;

  // TODO: add constraint "must satisfy regular expression '(?:[a-z0-9]+(?:[._-][a-z0-9]+)*/)*[a-z0-9]+(?:[._-][a-z0-9]+)*'"
  @Column()
  @cloudId
  repositoryName: string;

  @Column({
    nullable: true,
  })
  repositoryArn?: string;

  @Column({
    nullable: true,
  })
  registryId?: string;

  @Column({
    nullable: true,
  })
  repositoryUri?: string;

  @Column({
    nullable: true,
    type: 'timestamp with time zone',
  })
  createdAt?: Date;

  @Column({
    default: ImageTagMutability.MUTABLE,
    type: 'enum',
    enum: ImageTagMutability,
  })
  imageTagMutability: ImageTagMutability;

  @Column({
    default: false,
  })
  scanOnPush: boolean;

  @OneToMany(() => RepositoryImage, images => images.privateRepository, {
    nullable: true,
    eager: true,
  })
  images?: RepositoryImage[];

  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;

  // TODO: add encriptation configuration entity.
  // @Column({
  //   nullable: true,
  // })
  // encryptionConfiguration?: EncryptionConfiguration;
}
