import { Entity, Column, PrimaryGeneratedColumn, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { PublicRepository, Repository } from '.';
import { cloudId } from '../../../../services/cloud-id';

@Entity()
@Unique('uq_repository_image_region', ['id', 'privateRepositoryRegion'])
@Unique('uq_repository_image_id_region', ['imageId', 'privateRepositoryRegion'])
export class RepositoryImage {
  @PrimaryGeneratedColumn()
  id: number;

  // composed by digest + tag + repo type + repository name [+ region]
  @Column()
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
      name: 'private_repository_id',
      referencedColumnName: 'id',
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
