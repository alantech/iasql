import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToOne, Index } from 'typeorm';

import { Repository } from '.';

@Entity()
@Index(['id', 'region'], { unique: true })
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
      name: 'repository_name',
      referencedColumnName: 'repositoryName',
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
