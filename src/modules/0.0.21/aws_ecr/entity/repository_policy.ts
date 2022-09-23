import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, OneToOne } from 'typeorm';

import { Repository } from '.';

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
    name: 'repository_name',
  })
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
    primary: true,
  })
  region: string;
}
