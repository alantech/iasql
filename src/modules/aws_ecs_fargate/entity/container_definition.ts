import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { TaskDefinition } from '.';
import { AwsRegions } from '../../aws_account/entity';
import { LogGroup } from '../../aws_cloudwatch/entity';
import { PublicRepository, Repository } from '../../aws_ecr/entity';

/**
 * @enum
 * Different transport protocols to allow for this container definition
 * Supported values are TCP and UDP
 */
export enum TransportProtocol {
  TCP = 'tcp',
  UDP = 'udp',
}

/**
 * Table to manage AWS ECS container definitions. Container definitions are used in task definitions to describe the different containers that are launched as part of a task.
 *
 * @example
 * ```sql TheButton[Manage an ECS container definition]="Manage an ECS container definition"
 * INSERT INTO container_definition ("name", image, essential, memory_reservation, host_port, container_port, protocol, env_variables, task_definition_id, log_group_id)
 * VALUES('container_name', 'image_name', true, 2048, 6379, 6379, 'tcp', '{ "test": 2}', (select id from task_definition where family = 'task_definition' and status is null
 * and region = 'us-east-1' limit 1), (select id from log_group where log_group_name = 'log_group' and region = 'us-east-1'));
 *
 * SELECT * FROM container_definition WHERE name = 'container_name' AND image = 'image_name';
 *
 * DELETE FROM container_definition using task_definition where container_definition.task_definition_id = task_definition.id and task_definition.family = 'task_name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-ecs-integration.ts#L400
 * @see https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_ContainerDefinition.html
 *
 * `image` > `repository` > `publicRepository`
 * `digest` > `tag` > null
 */
@Check(
  `("image" is null and ("repository_id" is not null or "public_repository_name" is not null)) or "image" is not null`,
)
@Check(
  `("tag" is null and "digest" is null) or ("tag" is not null and "digest" is null) or ("tag" is null and "digest" is not null)`,
)
@Entity()
export class ContainerDefinition {
  /**
   * @private
   * Auto-incremented ID field for storing builds
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Name of the container definition
   */
  @Column()
  name: string;

  /**
   * @public
   * Reference of the associated task definition
   */
  @ManyToOne(() => TaskDefinition, {
    // if the parent task def is deleted, also delete this container def
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn()
  taskDefinition: TaskDefinition;

  /**
   * @public
   * The image used to start the container
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#image
   *
   * @privateRemarks
   * TODO: add constraint  Up to 255 letters (uppercase and lowercase), numbers, hyphens, underscores, colons, periods, forward slashes, and number signs are allowed.
   */
  @Column({ nullable: true })
  image?: string;

  /**
   * @public
   * The tag for the image used to start the container
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#image
   */
  @Column({ nullable: true })
  tag?: string;

  /**
   * @public
   * The sha-256 digest of the used image. Either tag or digest needs to be specified
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#image
   */
  @Column({ nullable: true })
  digest?: string;

  /**
   * @public
   * Reference of the repository where this image is hosted
   */
  @ManyToOne(() => Repository, {
    nullable: true,
    eager: true,
  })
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
  repository?: Repository;

  /**
   * @public
   * Reference to the public repository where this image is hosted
   */
  @ManyToOne(() => PublicRepository, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({
    name: 'public_repository_name',
  })
  publicRepository?: PublicRepository;

  /**
   * @public
   * If the essential parameter of a container is marked as true, and that container fails or stops for any reason,
   * all other containers that are part of the task are stopped. If the essential parameter of a container is marked as false,
   * its failure doesn't affect the rest of the containers in a task. If this parameter is omitted, a container is
   * assumed to be essential.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#essential
   */
  @Column({
    default: false,
  })
  essential: boolean;

  /**
   * @public
   * The number of cpu units reserved for the container.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#cpu
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  cpu?: number;

  /**
   * @public
   * The amount (in MiB) of memory to present to the container.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#memory
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  memory?: number;

  /**
   * @public
   * The soft limit (in MiB) of memory to reserve for the container.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#memoryreservation
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  memoryReservation?: number;

  /**
   * @public
   * Port to expose at host level. It can be left blank depending on the networking mode
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#portmappings
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  hostPort?: number;

  /**
   * @public
   * Port to expose at container level
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#portmappings
   */
  @Column({
    type: 'int',
    nullable: true,
  })
  containerPort?: number;

  /**
   * @public
   * The protocol for the exposed ports
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#portmappings
   */
  @Column({
    type: 'enum',
    enum: TransportProtocol,
    nullable: true,
  })
  protocol?: TransportProtocol;

  /**
   * @public
   * Complex type to specify a list of environment variables that the container can consume
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#environment
   */
  @Column({
    type: 'simple-json',
    nullable: true,
  })
  envVariables: { [key: string]: string };

  /**
   * @public
   * The log group where to render the container logs
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#logconfiguration
   */
  @ManyToOne(() => LogGroup, {
    nullable: true,
    eager: true,
  })
  @JoinColumn()
  logGroup?: LogGroup;

  /**
   * @public
   * Region for the container definition
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;
}
