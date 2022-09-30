import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToOne, Unique, ManyToOne } from 'typeorm';

import { Repository } from '.';
import { AwsRegions } from '../../aws_account/entity';

@Entity()
@Unique('uq_repository_policy_region', ['id', 'region'])
export class RepositoryPolicy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  registryId?: string;

  @OneToOne(() => Repository, { nullable: false, eager: true })
  @JoinColumn([
    {
      name: 'repository_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  repository: Repository;

  @Column({
    nullable: true,
  })
  policyText?: string;

  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;
}
