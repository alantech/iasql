import { Column, Entity, OneToMany, ManyToOne, JoinColumn, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { ContainerDefinition } from '.';
import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { IamRole } from '../../aws_iam/entity';

/**
 * @enum
 * Whether the task is active or inactive
 */
export enum TaskDefinitionStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

/**
 * @enum
 * Possible combinations of CPU and memory used by a task
 */
export enum CpuMemCombination {
  'vCPU0.25-0.5GB' = 'vCPU0.25-0.5GB',
  'vCPU0.25-1GB' = 'vCPU0.25-1GB',
  'vCPU0.25-2GB' = 'vCPU0.25-2GB',
  'vCPU0.5-1GB' = 'vCPU0.5-1GB',
  'vCPU0.5-2GB' = 'vCPU0.5-2GB',
  'vCPU0.5-3GB' = 'vCPU0.5-3GB',
  'vCPU0.5-4GB' = 'vCPU0.5-4GB',
  'vCPU1-2GB' = 'vCPU1-2GB',
  'vCPU1-3GB' = 'vCPU1-3GB',
  'vCPU1-4GB' = 'vCPU1-4GB',
  'vCPU1-5GB' = 'vCPU1-5GB',
  'vCPU1-6GB' = 'vCPU1-6GB',
  'vCPU1-7GB' = 'vCPU1-7GB',
  'vCPU1-8GB' = 'vCPU1-8GB',
  'vCPU2-4GB' = 'vCPU2-4GB',
  'vCPU2-5GB' = 'vCPU2-5GB',
  'vCPU2-6GB' = 'vCPU2-6GB',
  'vCPU2-7GB' = 'vCPU2-7GB',
  'vCPU2-8GB' = 'vCPU2-8GB',
  'vCPU2-9GB' = 'vCPU2-9GB',
  'vCPU2-10GB' = 'vCPU2-10GB',
  'vCPU2-11GB' = 'vCPU2-11GB',
  'vCPU2-12GB' = 'vCPU2-12GB',
  'vCPU2-13GB' = 'vCPU2-13GB',
  'vCPU2-14GB' = 'vCPU2-14GB',
  'vCPU2-15GB' = 'vCPU2-15GB',
  'vCPU2-16GB' = 'vCPU2-16GB',
  'vCPU4-8GB' = 'vCPU4-8GB',
  'vCPU4-9GB' = 'vCPU4-9GB',
  'vCPU4-10GB' = 'vCPU4-10GB',
  'vCPU4-11GB' = 'vCPU4-11GB',
  'vCPU4-12GB' = 'vCPU4-12GB',
  'vCPU4-13GB' = 'vCPU4-13GB',
  'vCPU4-14GB' = 'vCPU4-14GB',
  'vCPU4-15GB' = 'vCPU4-15GB',
  'vCPU4-16GB' = 'vCPU4-16GB',
  'vCPU4-17GB' = 'vCPU4-17GB',
  'vCPU4-18GB' = 'vCPU4-18GB',
  'vCPU4-19GB' = 'vCPU4-19GB',
  'vCPU4-20GB' = 'vCPU4-20GB',
  'vCPU4-21GB' = 'vCPU4-21GB',
  'vCPU4-22GB' = 'vCPU4-22GB',
  'vCPU4-23GB' = 'vCPU4-23GB',
  'vCPU4-24GB' = 'vCPU4-24GB',
  'vCPU4-25GB' = 'vCPU4-25GB',
  'vCPU4-26GB' = 'vCPU4-26GB',
  'vCPU4-27GB' = 'vCPU4-27GB',
  'vCPU4-28GB' = 'vCPU4-28GB',
  'vCPU4-29GB' = 'vCPU4-29GB',
  'vCPU4-30GB' = 'vCPU4-30GB',
}

/**
 * Table to manage AWS ECS task definitions. A task definition is required to run Docker containers in Amazon ECS.
 *
 * @example
 * ```sql TheButton[Manage an ECS task definition]="Manage an ECS task definition"
 * INSERT INTO task_definition ("family", task_role_name, execution_role_name, cpu_memory) VALUES ('family', 'task-name', 'task-role', 'vCPU4-25GB');
 *
 * SELECT * FROM task_definition WHERE family = 'family' AND status IS NULL;
 * delete from task_definition where family = 'family';
 * ```
 *
 * @see https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-ecs-integration.ts#L516
 * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html
 */
@Entity()
@Unique('uq_task_definition_id_region', ['id', 'region'])
export class TaskDefinition {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @private
   * AWS ARN for the task definition
   */
  @Column({
    nullable: true,
  })
  @cloudId
  taskDefinitionArn?: string;

  /**
   * @public
   * When you register a task definition, you give it a family, which is similar to a name for multiple versions of the task definition,
   * specified with a revision number. The first task definition that's registered into a particular family is given a revision of 1,
   * and any task definitions registered after that are given a sequential revision number.
   * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
   */
  @Column()
  family: string;

  /**
   * @public
   * Revision number to combine with the family parameter
   * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
   */
  @Column({
    nullable: true,
    type: 'int',
  })
  revision?: number;

  /**
   * @public
   * When you register a task definition, you can provide a task role for an IAM role that allows the containers in the task permission
   * to call the AWS APIs that are specified in its associated policies on your behalf.
   * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
   */
  @ManyToOne(() => IamRole, { nullable: true, eager: true })
  @JoinColumn({
    name: 'task_role_name',
  })
  taskRole?: IamRole;

  /**
   * @public
   * The Amazon Resource Name (ARN) of the task execution role that grants the Amazon ECS container agent permission to make AWS API
   * calls on your behalf. The task execution IAM role is required depending on the requirements of your task.
   * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
   */
  @ManyToOne(() => IamRole, { nullable: true, eager: true })
  @JoinColumn({
    name: 'execution_role_name',
  })
  executionRole?: IamRole;

  /**
   * @public
   * If the task is currently active or not
   * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: TaskDefinitionStatus,
  })
  status?: TaskDefinitionStatus;

  /**
   * @public
   * When you register a task definition, you can specify the total CPU and memory used for the task.
   * This is separate from the cpu and memory values at the container definition level.
   * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: CpuMemCombination,
  })
  cpuMemory: CpuMemCombination;

  /**
   * @public
   * Reference to the container definitions that are passed to the Docker daemon on a container instance.
   * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definitions
   */
  @OneToMany(() => ContainerDefinition, c => c.taskDefinition, {
    eager: true,
    cascade: true,
  })
  containerDefinitions: ContainerDefinition[];

  /**
   * @public
   * Region for the ECS service
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
