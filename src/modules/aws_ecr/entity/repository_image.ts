import { Entity, Column, PrimaryGeneratedColumn, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { PublicRepository, Repository } from '.';
import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * Table to manage images to be published in ECR repositories. Amazon Elastic Container Registry (Amazon ECR) stores Docker images, Open Container Initiative (OCI) images,
 * and OCI compatible artifacts in private repositories. You can use the Docker CLI, or your preferred client, to push and pull images to and from your repositories.
 *
 * This table can only list and delete the associated images
 *
 * @example
 * ```sql TheButton[Manage ECR repository images]="Manage ECR repository images"
 * SELECT * FROM repository_image WHERE private_repository_id = (select id from repository where repository_name = 'test-repo');
 * DELETE FROM public_repository WHERE repository_name = 'repository_name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ecr-integration.ts#L200
 * @see https://docs.aws.amazon.com/AmazonECR/latest/public/public-images.html
 */
@Entity()
@Unique('uq_repository_image_region', ['id', 'privateRepositoryRegion'])
@Unique('uq_repository_image_id_region', ['imageId', 'privateRepositoryRegion'])
export class RepositoryImage {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Internal ID for the instance
   * composed by digest + tag + repo type + repository name [+ region]
   */
  @Column()
  @cloudId
  imageId: string;

  /**
   * @public
   * The sha-256 digest of the image manifest
   */
  @Column()
  imageDigest: string;

  /**
   * @public
   * The tag used for the image
   */
  @Column()
  imageTag: string;

  /**
   * @public
   * The Amazon Web Services account ID associated with the registry to which this image belongs.
   */
  @Column({
    nullable: true,
  })
  registryId?: string;

  /**
   * @public
   * Date the image was pushed into the repository
   */
  @Column({
    nullable: true,
    type: 'timestamp with time zone',
  })
  pushedAt: Date;

  /**
   * @public
   * Size of the image in MB
   */
  @Column({
    nullable: true,
    type: 'int',
  })
  sizeInMB: number;

  /**
   * @public
   * Reference to the private repository that is containing the image
   */
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

  /**
   * @public
   * Reference to the public repository that is containing the image
   */
  @ManyToOne(() => PublicRepository, { nullable: true })
  @JoinColumn({
    name: 'public_repository',
  })
  publicRepository?: PublicRepository;

  /**
   * @public
   * In the case of a private repository, reference to the region where it belongs to
   */
  @Column({
    type: 'character varying',
    nullable: true,
  })
  @ManyToOne(() => AwsRegions, { nullable: true })
  @JoinColumn({ name: 'privateRepositoryRegion', referencedColumnName: 'region' })
  privateRepositoryRegion: string;
}
