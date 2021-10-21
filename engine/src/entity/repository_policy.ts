import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToOne, } from 'typeorm'

import { source, Source, } from '../services/source-of-truth'
import { awsPrimaryKey, } from '../services/aws-primary-key'
import { noDiff, } from '../services/diff'
import { Repository } from '.';

@source(Source.DB)
@Entity()
export class RepositoryPolicy {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  registryId?: string;

  @noDiff
  @OneToOne(() => Repository, { eager: true, })
  @JoinColumn({
    name: 'repository_id',
  })
  repository: Repository;

  // TODO: Update eventually to a generated column based on the Repository value to avoid inconsistencies.
  // https://github.com/typeorm/typeorm/pull/6469
  @awsPrimaryKey
  @Column({
    unique: true,
  })
  repositoryName: string;

  @Column({
    nullable: true,
  })
  policyText?: string;
}
