import { Entity, PrimaryGeneratedColumn, Column, OneToOne, } from 'typeorm'

import { source, Source, } from '../services/source-of-truth'
import { awsPrimaryKey, } from '../services/aws-primary-key'
import { noDiff, } from '../services/diff'
import { RepositoryPolicy } from '.';

export enum ImageTagMutability {
  IMMUTABLE = "IMMUTABLE",
  MUTABLE = "MUTABLE",
}

@source(Source.DB)
@Entity()
export class Repository {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

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

  @awsPrimaryKey
  @Column()
  repositoryName: string;

  @Column({
    nullable: true,
    type: 'timestamp with time zone',
  })
  createdAt?: Date;

  @Column({
    nullable: true,
    type: 'enum',
    enum: ImageTagMutability,
  })
  imageTagMutability?: ImageTagMutability;

  @Column({
    nullable: true,
  })
  scanOnPush?: boolean;

  @OneToOne(() => RepositoryPolicy, rp => rp.repository)
  repositoryPolicy: RepositoryPolicy;

  // TODO: add encriptation configuration entity.
  // @Column({
  //   nullable: true,
  // })
  // encryptionConfiguration?: EncryptionConfiguration;
}
