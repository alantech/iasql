import { Entity, PrimaryColumn, Column, } from 'typeorm'
import { cloudId, } from 'iasql/services/cloud-id'

@Entity()
export class PublicRepository {
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
}
