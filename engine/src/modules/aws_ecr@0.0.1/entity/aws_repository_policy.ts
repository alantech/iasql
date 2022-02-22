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

  @OneToOne(() => AwsRepository, { nullable: false, })
  @JoinColumn({
    name: 'repository_id',
  })
  repository: AwsRepository;

  @Column({
    nullable: true,
  })
  policyText?: string;
}
