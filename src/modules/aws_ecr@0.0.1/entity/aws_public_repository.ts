import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm'

import { cloudId, } from '../../../services/cloud-id'

@Entity()
export class AwsPublicRepository {
  @PrimaryGeneratedColumn()
  id: number;

  // TODO: add constraint "must satisfy regular expression '(?:[a-z0-9]+(?:[._-][a-z0-9]+)*/)*[a-z0-9]+(?:[._-][a-z0-9]+)*'"
  @Column({
    unique: true,
    nullable: false,
  })
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
}
