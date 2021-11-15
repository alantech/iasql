import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToOne, } from 'typeorm'

import { AwsRepository, } from '.'

@Entity()
export class AwsRepositoryPolicy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  registryId?: string;

  @OneToOne(() => AwsRepository, { nullable: true, })
  @JoinColumn({
    name: 'repository_id',
  })
  repository?: AwsRepository;

  // // TODO: Update eventually to a generated column based on the Repository value to avoid inconsistencies.
  // // https://github.com/typeorm/typeorm/pull/6469
  // @Column({
  //   unique: true,
  // })
  // repositoryName: string;

  @Column({
    nullable: true,
  })
  policyText?: string;
}
