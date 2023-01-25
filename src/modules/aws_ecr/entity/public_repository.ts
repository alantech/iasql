import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { RepositoryImage } from './repository_image';

/**
 * Table to manage AWS ECR public repositories. Amazon Elastic Container Registry provides API operations to create,
 * monitor, and delete public image repositories and set permissions that control who can push images to them.
 *
 * Amazon ECR integrates with the Docker CLI to push images from your development environments to your public repositories.
 *
 * @example
 * ```sql TheButton[Manage an ECR public repo]="Manage an ECR public repo"
 * INSERT INTO public_repository (repository_name) VALUES ('repository_name');
 * SELECT * FROM public_repository WHERE repository_name = 'repository_name';
 * DELETE FROM public_repository WHERE repository_name = 'repository_name';
 * ```
 *
 * @see https://github.com/iasql/iasql/blob/main/test/modules/aws-ecr-integration.ts#L432
 * @see https://docs.aws.amazon.com/AmazonECR/latest/public/public-repositories.html
 */
@Entity()
export class PublicRepository {
  /**
   * @public
   * Name of the repository
   *
   * @privateRemarks
   * TODO: add constraint "must satisfy regular expression '(?:[a-z0-9]+(?:[._-][a-z0-9]+)*\/)*[a-z0-9]+(?:[._-][a-z0-9]+)*'"
   */
  @PrimaryColumn()
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
   * List of associated images published on this repository
   */
  @OneToMany(() => RepositoryImage, images => images.publicRepository, {
    eager: true,
    nullable: true,
  })
  images?: RepositoryImage[];
}
