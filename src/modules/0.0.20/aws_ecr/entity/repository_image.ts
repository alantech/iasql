import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';

import { PublicRepository, Repository } from '.';
import { cloudId } from '../../../../services/cloud-id';

@Entity()
export class RepositoryImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @cloudId
  imageDigest: string;

  @Column('text', { array: true })
  imageTags: string[];

  @Column({
    nullable: true,
  })
  registryId?: string;

  @ManyToOne(() => Repository, { nullable: true, eager: true })
  @JoinColumn({
    name: 'private_repository',
  })
  privateRepository: Repository;

  @ManyToOne(() => PublicRepository, { nullable: true, eager: true })
  @JoinColumn({
    name: 'public_repository',
  })
  publicRepository: PublicRepository;
}
