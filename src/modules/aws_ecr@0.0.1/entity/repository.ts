import { Entity, PrimaryColumn, Column, } from 'typeorm'

import { cloudId, } from '../../../services/cloud-id'

export enum ImageTagMutability {
  IMMUTABLE = "IMMUTABLE",
  MUTABLE = "MUTABLE",
}

@Entity()
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

  // TODO: add encriptation configuration entity.
  // @Column({
  //   nullable: true,
  // })
  // encryptionConfiguration?: EncryptionConfiguration;
}
