import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm'

export enum ImageTagMutability {
  IMMUTABLE = "IMMUTABLE",
  MUTABLE = "MUTABLE",
}

@Entity()
export class AwsRepository {
  @PrimaryGeneratedColumn()
  id: number;

  // TODO: add constraint "must satisfy regular expression '(?:[a-z0-9]+(?:[._-][a-z0-9]+)*/)*[a-z0-9]+(?:[._-][a-z0-9]+)*'"
  @Column({
    unique: true,
    nullable: true,
  })
  repositoryName?: string;

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
