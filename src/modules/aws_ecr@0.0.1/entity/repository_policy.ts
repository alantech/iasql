import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToOne, } from 'typeorm'

import { Repository, } from '.'

@Entity()
export class RepositoryPolicy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  registryId?: string;

  @OneToOne(() => Repository, { nullable: false, eager: true })
  @JoinColumn({
    name: 'repository_id',
  })
  repository: Repository;

  @Column({
    nullable: true,
  })
  policyText?: string;
}
