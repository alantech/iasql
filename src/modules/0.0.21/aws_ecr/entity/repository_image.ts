import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { PublicRepository, Repository } from '.';
import { cloudId } from '../../../../services/cloud-id';

@Entity()
export class RepositoryImage {
  // composed by digest + tag + repo type + repository name [+ region]
  @PrimaryColumn()
  @cloudId
  imageId: string;

  @Column()
  imageDigest: string;

  @Column()
  imageTag: string;

  @Column({
    nullable: true,
  })
  registryId?: string;

  @ManyToOne(() => Repository, { nullable: true })
  @JoinColumn([
    {
      name: 'private_repository',
      referencedColumnName: 'repositoryName',
    },
    {
      name: 'private_repository_region',
      referencedColumnName: 'region',
    },
  ])
  privateRepository?: Repository;

  @ManyToOne(() => PublicRepository, { nullable: true })
  @JoinColumn({
    name: 'public_repository',
  })
  publicRepository?: PublicRepository;

  // This column is joined to `aws_regions` manually via hooks in the `../sql` directory
  @Column({
    type: 'character varying',
    nullable: true,
  })
  privateRepositoryRegion?: string;
}
