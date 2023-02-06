import { Entity, Column, OneToMany, PrimaryGeneratedColumn, Unique, ManyToOne, JoinColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { RepositoryImage } from './repository_image';

/**
 * @enum
 * Different values to define the image tag mutability. You can configure a repository to enable tag mutability to
 * prevent image tags from being overwritten. After the repository is configured for immutable tags,
 * an ImageTagAlreadyExistsException error is returned if you attempt to push an image with a tag that is already
 * in the repository. When tag immutability is enabled for a repository, this affects all tags and you cannot make
 * some tags immutable while others aren't.
 * @see https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html
 */
export enum ImageTagMutability {
  IMMUTABLE = 'IMMUTABLE',
  MUTABLE = 'MUTABLE',
}

/**
 * Table to manage AWS ECR private repositories. Amazon Elastic Container Registry (Amazon ECR) provides API operations to create,
 * monitor, and delete image repositories and set permissions that control who can access them.
 *
 * @see https://docs.aws.amazon.com/AmazonECR/latest/userguide/Repositories.html
 */
@Entity()
@Unique('uq_repository_id_region', ['id', 'region'])
@Unique('uq_repository_name_region', ['repositoryName', 'region'])
export class Repository {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Name of the repository
   */
  // TODO: add constraint "must satisfy regular expression '(?:[a-z0-9]+(?:[._-][a-z0-9]+)*/)*[a-z0-9]+(?:[._-][a-z0-9]+)*'"
  @Column()
  @cloudId
  repositoryName: string;

  /**
   * @public
   * AWS ARN identifier for the repository
   */
  @Column({
    nullable: true,
  })
  repositoryArn?: string;

  /**
   * @public
   * The Amazon Web Services account ID associated with the registry that contains the repositories to be
   * described. If you do not specify a registry, the default registry is assumed.
   * @see https://docs.aws.amazon.com/cli/latest/reference/ecr/describe-repositories.html
   */
  @Column({
    nullable: true,
  })
  registryId?: string;

  /**
   * @public
   * The URI for the repository
   */
  @Column({
    nullable: true,
  })
  repositoryUri?: string;

  /**
   * @public
   * Creation date
   */
  @Column({
    nullable: true,
    type: 'timestamp with time zone',
  })
  createdAt?: Date;

  /**
   * @public
   * You can configure a repository to enable tag mutability to prevent image tags from being overwritten
   * @see https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html
   */
  @Column({
    default: ImageTagMutability.MUTABLE,
    type: 'enum',
    enum: ImageTagMutability,
  })
  imageTagMutability: ImageTagMutability;

  /**
   * @public
   * Whether to scan the images as soon as it is pushed to the repository
   * @see https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning.html
   */
  @Column({
    default: false,
  })
  scanOnPush: boolean;

  /**
   * @public
   * List of associated images published on this repository
   */
  @OneToMany(() => RepositoryImage, images => images.privateRepository, {
    nullable: true,
    eager: true,
  })
  images?: RepositoryImage[];

  /**
   * @public
   * Reference to the associated region
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;

  // TODO: add encriptation configuration entity.
  // @Column({
  //   nullable: true,
  // })
  // encryptionConfiguration?: EncryptionConfiguration;
}
