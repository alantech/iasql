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
  // composed by digest + tag + repo type + repository name
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

  @ManyToOne(() => Repository, { nullable: true, eager: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'private_repository',
  })
  privateRepository?: Repository;

  @ManyToOne(() => PublicRepository, { nullable: true, eager: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'public_repository',
  })
  publicRepository?: PublicRepository;
}
