import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToOne, Unique } from 'typeorm';

import { Repository } from '.';

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

  // This column is joined to `aws_regions` manually via hooks in the `../sql` directory
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  region: string;
}
