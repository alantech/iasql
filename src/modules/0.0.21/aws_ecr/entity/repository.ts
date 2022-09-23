import { Entity, PrimaryColumn, Column, OneToMany, Index } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { RepositoryImage } from './repository_image';

export enum ImageTagMutability {
  IMMUTABLE = 'IMMUTABLE',
  MUTABLE = 'MUTABLE',
}


@Entity()
@Index(["repositoryName", "region"], { unique: true })
export class Repository {
  // TODO: add constraint "must satisfy regular expression '(?:[a-z0-9]+(?:[._-][a-z0-9]+)*/)*[a-z0-9]+(?:[._-][a-z0-9]+)*'"
  @PrimaryColumn()
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

  // This column is joined to `aws_regions` manually via hooks in the `../sql` directory
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  region: string;

  // TODO: add encriptation configuration entity.
  // @Column({
  //   nullable: true,
  // })
  // encryptionConfiguration?: EncryptionConfiguration;
}
