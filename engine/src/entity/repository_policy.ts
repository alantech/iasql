import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToOne, } from 'typeorm'

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

  @awsPrimaryKey
  @OneToOne(() => Repository, { eager: true, })
  @JoinColumn({
    name: 'repository_id',
  })
  repository: Repository;


  @Column({
    nullable: true,
  })
  policyText?: string;
}
